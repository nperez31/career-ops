#!/usr/bin/env node

// Native .docx CV renderer — the Word twin of build-cv-html.mjs (#557's
// approach applied to a second output format). Reads the exact same JSON
// payload the HTML/PDF pipeline uses (see modes/pdf.md) and produces a real,
// natively-editable Word document instead of converting the rendered HTML —
// HTML-to-docx converters reliably mangle CSS (flex layouts, floats,
// pseudo-elements), so this constructs the document directly with the `docx`
// library's own paragraph/style primitives.
//
// Style values below reproduce the Marriott School of Business resume format
// decoded from Marriott-Resume-Template.docx during the cv-template.marriott.html
// build (see that file's header comment for the full decode notes): Times New
// Roman body, Arial bold small-caps headings, bold company/italic role lines
// with a right tab stop, 0.6/0.6/0.5/0.6in margins (the .docx's own top/bottom
// values are reproduced there as a deliberate deviation for the same reason —
// see that file for why).
//
// This script only supports the Marriott layout. The HTML pipeline's other
// templates (standard, classic) do not have a docx counterpart yet — extend
// this file or branch on a --template flag if one is needed later.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, TabStopType, ExternalHyperlink,
  convertInchesToTwip, LevelFormat,
} from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Shared style constants (Marriott spec) ─────────────────────────

const FONT_SERIF = 'Times New Roman';
const FONT_SANS = 'Arial';
const SZ = { name: 28, contact: 20, section: 22, job: 21, body: 20, small: 18 }; // half-points
const COLOR_BLACK = '000000';

const MARGIN = {
  top: convertInchesToTwip(0.6),
  right: convertInchesToTwip(0.6),
  bottom: convertInchesToTwip(0.5),
  left: convertInchesToTwip(0.6),
};

// Standard OOXML page dimensions, twips. Matches build-cv-html.mjs's
// PAGE_WIDTHS table (8.5in / 210mm) so the docx and HTML/PDF outputs agree.
const PAGE_SIZES = {
  letter: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
  a4: { width: convertInchesToTwip(210 / 25.4), height: convertInchesToTwip(297 / 25.4) },
};

/**
 * Resolve page size + the right-aligned tab stop position for company/date
 * lines from `payload.page_format`.
 *
 * `docx`'s own `TabStopPosition.MAX` is a FIXED constant (9026 twips = 6.27in)
 * calibrated for the library's own page/margin defaults — it does not adapt to
 * this document's actual margins, so a right tab stop built from it lands
 * about an inch short of the true right margin. Computing the stop from the
 * real content width (page width minus left/right margin) is what actually
 * right-aligns to the page, exactly as the Marriott .docx's own "Resume"
 * style does (a right tab at a literal twip position, not a symbolic max).
 *
 * @param {string} [pageFormat] - "letter" or "a4"; defaults to "letter",
 *   matching build-cv-html.mjs's PAGE_WIDTHS fallback.
 * @returns {{size: {width: number, height: number}, rightTab: number}}
 */
export function resolvePageGeometry(pageFormat) {
  const size = PAGE_SIZES[String(pageFormat || '').toLowerCase()] || PAGE_SIZES.letter;
  const rightTab = size.width - MARGIN.left - MARGIN.right;
  return { size, rightTab };
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BLACK, space: 1 } },
    children: [new TextRun({
      text, bold: true, smallCaps: true, font: FONT_SANS, size: SZ.section, color: COLOR_BLACK,
    })],
  });
}

function contactRun(text, url) {
  if (!url) return new TextRun({ text, font: FONT_SERIF, size: SZ.contact, color: COLOR_BLACK });
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, font: FONT_SERIF, size: SZ.contact, color: COLOR_BLACK })],
  });
}

function header(candidate) {
  const c = candidate || {};
  const items = [];
  if (c.phone) items.push(contactRun(c.phone, `tel:${String(c.phone).replace(/\s+/g, '')}`));
  if (c.email) items.push(contactRun(c.email, `mailto:${c.email}`));
  if (c.linkedin && c.linkedin.url) items.push(contactRun(c.linkedin.display || c.linkedin.url, c.linkedin.url));
  if (c.portfolio && c.portfolio.url) items.push(contactRun(c.portfolio.display || c.portfolio.url, c.portfolio.url));
  if (c.location) items.push(new TextRun({ text: c.location, font: FONT_SERIF, size: SZ.contact, color: COLOR_BLACK }));

  const sep = () => new TextRun({ text: ' | ', font: FONT_SERIF, size: SZ.contact, color: COLOR_BLACK });
  const contactChildren = [];
  items.forEach((item, i) => {
    if (i > 0) contactChildren.push(sep());
    contactChildren.push(item);
  });

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: c.name || '', bold: true, font: FONT_SERIF, size: SZ.name, color: COLOR_BLACK })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: contactChildren }),
  ];
}

function bulletList(bullets) {
  return (bullets || []).filter(Boolean).map(text => new Paragraph({
    numbering: { reference: 'cv-bullets', level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, font: FONT_SERIF, size: SZ.body, color: COLOR_BLACK })],
  }));
}

// Company/org (bold, left) + location (italic, right) sharing one tab-stopped
// line, then role (italic, left) + dates (right) on the next — the same
// pairing cv-template.marriott.html achieves with CSS float, done here with a
// right tab stop, matching the source .docx's own "Resume" style exactly.
// `rightTab` is the actual content-width-derived stop from resolvePageGeometry
// — see that function for why it must not be docx's own TabStopPosition.MAX.
function experienceEntry(entry, rightTab) {
  const paras = [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
      spacing: { before: 120 },
      children: [
        new TextRun({ text: entry.company || '', bold: true, font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK }),
        new TextRun({ text: '\t' + (entry.location || ''), italics: true, font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK }),
      ],
    }),
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
      children: [
        new TextRun({ text: entry.role || '', italics: true, font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK }),
        new TextRun({ text: '\t' + (entry.dates || entry.period || ''), font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK }),
      ],
    }),
    ...bulletList(entry.bullets),
  ];
  return paras;
}

// Institution (bold, left) + location (right) then degree/GPA line (italic) —
// same field convention as the HTML template: education[].year holds the
// location text, not a year. See cv-template.marriott.html for the rationale.
function educationEntry(entry, rightTab) {
  const paras = [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
      spacing: { before: 120 },
      children: [
        new TextRun({ text: entry.title || '', bold: true, font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK }),
        new TextRun({ text: '\t' + (entry.year || ''), font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK }),
      ],
    }),
  ];
  if (entry.description) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: entry.description, italics: true, font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK })],
    }));
  }
  return paras;
}

function certificationLine(certifications) {
  const titles = (certifications || []).map(c => c.title).filter(Boolean);
  return new Paragraph({
    spacing: { before: 60 },
    children: [new TextRun({ text: titles.join('  |  '), font: FONT_SERIF, size: SZ.body, color: COLOR_BLACK })],
  });
}

function skillsBlock(skills) {
  return (skills || []).filter(s => s && s.category).map(s => {
    const items = Array.isArray(s.items) ? s.items.join(', ') : (s.items || '');
    return new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: `${s.category}: `, bold: true, font: FONT_SERIF, size: SZ.body, color: COLOR_BLACK }),
        new TextRun({ text: items, font: FONT_SERIF, size: SZ.body, color: COLOR_BLACK }),
      ],
    });
  });
}

/**
 * Build the docx Document object from a career-ops CV payload.
 * @param {object} payload - Same schema as build-cv-html.mjs's JSON input.
 * @returns {Document}
 */
export function buildCvDocx(payload) {
  const { size, rightTab } = resolvePageGeometry(payload.page_format);

  const children = [];
  children.push(...header(payload.candidate));

  if (Array.isArray(payload.education) && payload.education.length) {
    children.push(sectionTitle((payload.sections && payload.sections.education) || 'Education'));
    for (const e of payload.education) children.push(...educationEntry(e, rightTab));
  }
  if (Array.isArray(payload.experience) && payload.experience.length) {
    children.push(sectionTitle((payload.sections && payload.sections.experience) || 'Experience'));
    for (const e of payload.experience) children.push(...experienceEntry(e, rightTab));
  }
  if (Array.isArray(payload.leadership) && payload.leadership.length) {
    children.push(sectionTitle((payload.sections && payload.sections.leadership) || 'Leadership & Service'));
    for (const e of payload.leadership) children.push(...experienceEntry(e, rightTab));
  }
  if (Array.isArray(payload.projects) && payload.projects.length) {
    children.push(sectionTitle((payload.sections && payload.sections.projects) || 'Projects'));
    for (const p of payload.projects) {
      children.push(new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: p.name || '', bold: true, font: FONT_SERIF, size: SZ.job, color: COLOR_BLACK })],
      }));
      const desc = p.description || (Array.isArray(p.bullets) ? p.bullets.join(' ') : '');
      if (desc) {
        children.push(new Paragraph({
          children: [new TextRun({ text: desc, font: FONT_SERIF, size: SZ.body, color: COLOR_BLACK })],
        }));
      }
    }
  }
  if (Array.isArray(payload.certifications) && payload.certifications.length) {
    children.push(sectionTitle((payload.sections && payload.sections.certifications) || 'Certifications'));
    children.push(certificationLine(payload.certifications));
  }
  if (Array.isArray(payload.skills) && payload.skills.length) {
    children.push(sectionTitle((payload.sections && payload.sections.skills) || 'Skills'));
    children.push(...skillsBlock(payload.skills));
  }

  return new Document({
    numbering: {
      config: [{
        reference: 'cv-bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '▪',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.18) } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { size, margin: MARGIN } },
      children,
    }],
  });
}

// ── CLI ─────────────────────────────────────────────────────────────

function runGeometryTest() {
  let passed = 0, failed = 0;
  const eq = (label, actual, expected) => {
    if (actual === expected) passed++;
    else { failed++; console.log(`  FAIL: ${label}\n    expected ${expected}, got ${actual}`); }
  };

  const letter = resolvePageGeometry('letter');
  eq('letter page width is 8.5in in twips', letter.size.width, convertInchesToTwip(8.5));
  eq('letter page height is 11in in twips', letter.size.height, convertInchesToTwip(11));
  // Assert the real invariant (tab stop = page width minus the ACTUAL margins
  // this document uses) rather than an independently-rounded "7.3in" constant:
  // convertInchesToTwip(0.6) rounds to 863, not the mathematically exact 864,
  // so a separately-computed expected value drifts by a couple of twips —
  // utterly invisible in print, but wrong to assert against. What must be true
  // is that the tab stop and the rendered margin agree with each other.
  eq('letter right tab equals page width minus the two margins actually applied',
    letter.rightTab, letter.size.width - MARGIN.left - MARGIN.right);
  // Sanity bound: still within half a point of 7.3in, so a real regression
  // (e.g. reintroducing TabStopPosition.MAX) still fails loudly.
  eq('letter right tab is within rounding noise of 7.3in',
    Math.abs(letter.rightTab - convertInchesToTwip(7.3)) <= 2, true);

  const a4 = resolvePageGeometry('a4');
  eq('a4 page width is 210mm in twips', a4.size.width, convertInchesToTwip(210 / 25.4));
  eq('a4 right tab is narrower than letter (A4 is narrower than Letter)', a4.rightTab < letter.rightTab, true);

  eq('missing page_format defaults to letter', resolvePageGeometry(undefined).rightTab, letter.rightTab);
  eq('unrecognized page_format defaults to letter', resolvePageGeometry('tabloid').rightTab, letter.rightTab);

  // Regression: docx's own TabStopPosition.MAX (9026 twips) undershoots the
  // real letter-page right margin by roughly an inch — the exact bug report.
  eq('right tab does NOT fall back to the undersized library constant (9026 twips)',
    letter.rightTab === 9026, false);

  console.log(`\nbuild-cv-docx geometry test: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

async function runSelfTest() {
  runGeometryTest();

  const sample = {
    candidate: {
      name: 'Test Candidate',
      phone: '(555) 555-0100',
      email: 'test@example.com',
      linkedin: { url: 'https://linkedin.com/in/test', display: 'linkedin.com/in/test' },
      location: 'City, State',
    },
    education: [{ title: 'Test University', org: '', year: 'City, ST', description: 'B.S. Computer Science, GPA 3.9' }],
    experience: [{
      company: 'Test Corp', role: 'Test Engineer', location: 'Remote', dates: 'June 2024 - Present',
      bullets: ['Built automated testing pipelines with CI/CD integration', 'Cut regression test time from 2 hours to 20 minutes'],
    }],
    certifications: [{ title: 'Certified Kubernetes Administrator' }],
    skills: [{ category: 'Languages', items: 'Python, JavaScript, TypeScript' }],
  };

  const doc = buildCvDocx(sample);
  const buffer = await Packer.toBuffer(doc);

  if (buffer.length < 1000) {
    console.error(`Self-test failed: output suspiciously small (${buffer.length} bytes)`);
    process.exit(1);
  }
  // A valid .docx is a zip archive — PK\x03\x04 is the local-file-header magic.
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    console.error('Self-test failed: output is not a valid zip/docx container');
    process.exit(1);
  }

  console.log(JSON.stringify({ status: 'self-test-passed', sizeKB: parseFloat((buffer.length / 1024).toFixed(1)) }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    await runSelfTest();
    return;
  }

  const [inputPath, outputPath] = args;
  if (!inputPath || !outputPath) {
    console.error('Usage: node build-cv-docx.mjs <input.json> <output.docx>');
    console.error('       node build-cv-docx.mjs --test');
    process.exit(1);
  }
  const absInput = resolve(inputPath);
  const absOutput = resolve(outputPath);
  if (!existsSync(absInput)) {
    console.error(`Input file not found: ${absInput}`);
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(await readFile(absInput, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse input JSON: ${err.message}`);
    process.exit(1);
  }

  const doc = buildCvDocx(payload);
  const buffer = await Packer.toBuffer(doc);

  const outDir = dirname(absOutput);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  await writeFile(absOutput, buffer);

  console.log(JSON.stringify({
    file: absOutput,
    sizeKB: parseFloat((buffer.length / 1024).toFixed(1)),
    experienceEntries: (payload.experience || []).length,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
