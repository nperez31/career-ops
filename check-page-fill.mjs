#!/usr/bin/env node

/**
 * check-page-fill.mjs — measures how much of the page a built CV actually
 * fills, and flags both directions of the failure: overflow (2+ pages) AND
 * a sparse-looking page that technically fits on one page but reads as
 * unfinished. `generate-pdf.mjs`'s own page count only catches the first.
 *
 * Candidate observation, 2026-08-21: a resume that stops 3/4 of the way down
 * the page "looks bare" even though it's technically one page. The fix for
 * that is always MORE REAL CONTENT — restoring a relevant bullet, an
 * omitted section — never inflated font size, line-height, or margins to
 * fake fullness. This script only measures; modes/pdf.md's Step 18c decides
 * what to add back, same division of labor as resume-lint.mjs (linter
 * surfaces, agent judgment resolves).
 *
 * Reuses generate-pdf.mjs's own page_margin resolution (the template's
 * `<!-- career-ops-template ... page_margin: ... -->` metadata, which
 * survives into the built HTML) so this measures against the EXACT margins
 * the PDF will actually render with — not an independently-guessed value.
 *
 * Usage:
 *   node check-page-fill.mjs output/cv-jane-acme.html
 *   node check-page-fill.mjs output/cv-jane-acme.html --format=a4
 *   node check-page-fill.mjs output/cv-jane-acme.html --summary
 *   node check-page-fill.mjs --self-test
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolvePageMargin } from './generate-pdf.mjs';

// ── Page geometry (pure, no browser needed) ─────────────────────────

const DPI = 96;
const PAGE_SIZE_IN = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 210 / 25.4, height: 297 / 25.4 },
};

const UNIT_TO_IN = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4, pt: 1 / 72, px: 1 / 96 };

/**
 * Parse a CSS margin shorthand (1-4 length values) into {top,right,bottom,left}
 * inches, following the standard CSS shorthand expansion rules.
 * @param {string} marginCss - e.g. "0.6in" or "0.6in 0.6in 0.5in 0.6in"
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function parseMarginToInches(marginCss) {
  const parts = String(marginCss || '').trim().split(/\s+/).map(p => {
    const m = p.match(/^(\d+(?:\.\d+)?)(in|cm|mm|pt|px)$/);
    if (!m) return null;
    return parseFloat(m[1]) * UNIT_TO_IN[m[2]];
  });
  if (parts.some(p => p === null) || parts.length === 0) {
    throw new Error(`Unrecognized margin shorthand: "${marginCss}"`);
  }
  const [a, b = a, c = a, d = b] = parts; // CSS shorthand: 1, 2, 3, or 4 values
  return { top: a, right: b, bottom: c, left: d };
}

/**
 * Resolve the printable content box for a built CV, in pixels at 96dpi.
 * @param {string} html - Built CV HTML (post build-cv-html.mjs).
 * @param {string} [format] - "letter" or "a4"; defaults to "letter".
 * @returns {{widthPx: number, heightPx: number, marginCss: string}}
 */
export function resolveContentBoxPx(html, format) {
  const size = PAGE_SIZE_IN[String(format || 'letter').toLowerCase()] || PAGE_SIZE_IN.letter;
  const marginCss = resolvePageMargin(html);
  const margin = parseMarginToInches(marginCss);
  return {
    widthPx: Math.round((size.width - margin.left - margin.right) * DPI),
    heightPx: Math.round((size.height - margin.top - margin.bottom) * DPI),
    marginCss,
  };
}

// Below this fraction of the page, a one-page document reads as sparse
// rather than intentionally concise. Above 100% it has already overflowed
// to a second page, which generate-pdf.mjs's own page count already catches.
const SPARSE_THRESHOLD = 0.85;

/**
 * Classify a fill ratio (rendered content height / available content height).
 * @param {number} ratio
 * @returns {"overflow"|"sparse"|"ok"}
 */
export function classifyFill(ratio) {
  if (ratio > 1) return 'overflow';
  if (ratio < SPARSE_THRESHOLD) return 'sparse';
  return 'ok';
}

// ── Live measurement (requires Playwright) ──────────────────────────

/**
 * Render the built HTML and measure its actual content height.
 * @param {string} html
 * @param {number} widthPx
 * @returns {Promise<number>} scrollHeight of the .page element, in px.
 */
async function measureRenderedHeight(html, widthPx) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: widthPx, height: 2000 } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    return await page.evaluate(() => {
      const el = document.querySelector('.page') || document.body;
      return el.scrollHeight;
    });
  } finally {
    await browser.close();
  }
}

/**
 * Full check: render, measure, classify.
 * @param {string} html
 * @param {string} [format]
 * @returns {Promise<{ratio: number, percent: number, status: string, renderedHeightPx: number, availableHeightPx: number, marginCss: string}>}
 */
export async function checkPageFill(html, format) {
  const box = resolveContentBoxPx(html, format);
  const renderedHeightPx = await measureRenderedHeight(html, box.widthPx);
  const ratio = renderedHeightPx / box.heightPx;
  return {
    ratio,
    percent: Math.round(ratio * 1000) / 10,
    status: classifyFill(ratio),
    renderedHeightPx,
    availableHeightPx: box.heightPx,
    marginCss: box.marginCss,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────

function runSelfTest() {
  let passed = 0, failed = 0;
  const eq = (label, actual, expected) => {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) passed++;
    else { failed++; console.log(`  FAIL: ${label}\n    expected ${e}, got ${a}`); }
  };

  eq('single-value margin shorthand applies to all sides',
    parseMarginToInches('0.6in'), { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 });
  eq('four-value margin shorthand maps top/right/bottom/left in order',
    parseMarginToInches('0.6in 0.6in 0.5in 0.6in'), { top: 0.6, right: 0.6, bottom: 0.5, left: 0.6 });
  eq('two-value margin shorthand: first=vertical, second=horizontal',
    parseMarginToInches('0.5in 0.6in'), { top: 0.5, right: 0.6, bottom: 0.5, left: 0.6 });
  // 1cm = 1/2.54 in ≈ 0.3937in — within float rounding.
  const cmResult = parseMarginToInches('1cm');
  eq('cm units convert to inches', Math.abs(cmResult.top - 1 / 2.54) < 1e-9, true);

  const letterBox = resolveContentBoxPx('<html></html>', 'letter');
  eq('default (no template metadata) uses the shared 0.6in margin, all sides', letterBox.marginCss, '0.6in');
  // 8.5in - 1.2in = 7.3in content width; 11in - 1.2in = 9.8in content height, at 96dpi.
  eq('letter content width at default margin is 7.3in in px', letterBox.widthPx, Math.round(7.3 * 96));
  eq('letter content height at default margin is 9.8in in px', letterBox.heightPx, Math.round(9.8 * 96));

  const marriottHtml = '<!-- career-ops-template\nname: Marriott School\npage_margin: 0.6in 0.6in 0.5in 0.6in\n-->';
  const marriottBox = resolveContentBoxPx(marriottHtml, 'letter');
  eq('template-declared page_margin overrides the shared default', marriottBox.marginCss, '0.6in 0.6in 0.5in 0.6in');
  eq('marriott content height accounts for the asymmetric top/bottom margin',
    marriottBox.heightPx, Math.round((11 - 0.6 - 0.5) * 96));

  eq('ratio > 1 classifies as overflow', classifyFill(1.05), 'overflow');
  eq('ratio exactly at the sparse threshold classifies as ok', classifyFill(0.85), 'ok');
  eq('ratio just under the sparse threshold classifies as sparse', classifyFill(0.84), 'sparse');
  eq('ratio of 1 (exactly full) classifies as ok', classifyFill(1), 'ok');

  console.log(`\ncheck-page-fill self-test: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const summaryMode = args.includes('--summary');
  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : 'letter';
  const target = args.find(a => !a.startsWith('--'));

  if (!target || !existsSync(target)) {
    console.error('Usage: node check-page-fill.mjs <built.html> [--format=letter|a4] [--summary]');
    console.error('       node check-page-fill.mjs --self-test');
    process.exit(1);
  }

  const html = readFileSync(target, 'utf-8');
  const result = await checkPageFill(html, format);

  if (summaryMode) {
    console.log(`\nPage Fill — ${target}`);
    console.log('─'.repeat(40));
    console.log(`Fill: ${result.percent}% (${result.renderedHeightPx}px of ${result.availableHeightPx}px available, margin ${result.marginCss})`);
    if (result.status === 'overflow') {
      console.log('⚠️  OVERFLOW — content exceeds one page.');
    } else if (result.status === 'sparse') {
      console.log(`⚠️  SPARSE — under the ${Math.round(SPARSE_THRESHOLD * 100)}% target. Add real, relevant, metric-backed content — never inflate spacing or font size to fake fullness.`);
    } else {
      console.log('✅ OK — fills the page without overflowing.');
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.status === 'ok' ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
