#!/usr/bin/env node

/**
 * resume-lint.mjs — Zero-LLM Harvard-standards linter for generated CVs and
 * cover letters.
 *
 * `AGENTS.md` states: "Reinforcement-without-enforcement decays." Documenting
 * the Harvard MCS resume rules in `modes/heuristics/harvard-resume.md` is not
 * enough on its own — an agent that has to remember them will eventually not.
 * This script checks the mechanically checkable subset of those rules against
 * built HTML, the same way `verify-cv-facts.mjs` gates fabricated metrics.
 *
 * It reads rendered HTML (the output of build-cv-html.mjs /
 * generate-cover-letter.mjs), not cv.md, so it catches problems introduced
 * during tailoring rather than only problems already in the source.
 *
 * Checks (see harvard-resume.md for the sourcing of each):
 *   pronoun        first-person pronouns              (resume only)
 *   passive        passive-voice constructions
 *   weak-verb      "responsible for" / "helped" / ... bullet openers
 *   no-metric      bullets with no number at all      (resume only)
 *   weak-metric    numbers present but small and static (resume only)
 *   date-first     bullets/lines that open with a date
 *   abbreviation   non-allowlisted ALLCAPS shorthand
 *   contact        missing email or phone             (resume only)
 *   qualifier-repetition  "X+" used too many times across the whole document
 *                          without variation ("over X", "more than X")
 *
 * `weak-metric` is a prompt for a judgment call, never an instruction to
 * inflate a number. See `modes/heuristics/metric-impact.md` for the rework
 * protocol and its anti-inflation rule.
 *
 * Severity: `error` fails the run (exit 1); `warn` reports but exits 0, because
 * the check is heuristic and a human should adjudicate.
 *
 * Usage:
 *   node resume-lint.mjs output/cv-jane-acme.html
 *   node resume-lint.mjs output/cv-jane-acme.html --summary
 *   node resume-lint.mjs output/cv.html --cover output/cover.html   (font-pair check)
 *   node resume-lint.mjs --self-test
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

// ── Text extraction ─────────────────────────────────────────────────

/** Strip tags/comments/style/script and decode the entities the renderer emits. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Pull the text of each <li> — the bullet-level checks only apply to these. */
function extractBullets(html) {
  return [...String(html || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(m => htmlToText(m[1]))
    .filter(Boolean);
}

/** Pull the declared body font-family + font-size for the CV/cover pair check. */
export function extractBodyFont(html) {
  const body = String(html || '').match(/\bbody\s*\{([\s\S]*?)\}/i);
  if (!body) return { family: null, size: null };
  const family = (body[1].match(/font-family\s*:\s*([^;]+)/i) || [])[1];
  const size = (body[1].match(/font-size\s*:\s*([^;]+)/i) || [])[1];
  return {
    family: family ? family.trim().replace(/\s+/g, ' ') : null,
    size: size ? size.trim() : null,
  };
}

// ── Rules ───────────────────────────────────────────────────────────

const PRONOUN_RE = /(?<![\w'])(I|I'm|I've|I'll|my|me|mine)(?![\w'])/gi;

// Auxiliary + past participle. Restricted to -ed/-en participles plus the
// common irregulars that actually show up in resumes, so "was responsible"
// (an adjective, caught by weak-verb instead) does not double-report here.
// Excludes "without being/getting X" — that's a proactivity idiom ("delivers
// without being asked"), not the agent-obscuring passive voice this check
// targets, and it is common, legitimate JD-mirroring language.
const PASSIVE_RE =
  /(?<!without )\b(?:was|were|is|are|been|being|be)\s+(?:\w+ly\s+)?(?:\w+(?:ed|en)|built|led|run|held|sent|made|kept|given|taken|written|driven|chosen|shown)\b/gi;

const WEAK_OPENERS = [
  'responsible for', 'helped', 'assisted', 'worked on', 'participated in',
  'involved in', 'tasked with', 'duties included', 'in charge of',
];

// Abbreviations common enough in tech hiring to read as industry-standard.
// Anything else in ALLCAPS gets flagged for a human to confirm.
const ALLOWED_ABBREVIATIONS = new Set([
  'AI', 'ML', 'LLM', 'NLP', 'RAG', 'MCP', 'API', 'APIs', 'REST', 'SQL', 'ETL', 'ELT',
  'CI', 'CD', 'AWS', 'GCP', 'SDK', 'CLI', 'HTTP', 'HTTPS', 'JSON', 'YAML', 'CSV', 'XML',
  'BI', 'KPI', 'KPIs', 'CRM', 'ERP', 'SaaS', 'PaaS', 'IaaS', 'GPU', 'CPU', 'RAM',
  'RBAC', 'SSO', 'PII', 'PHI', 'HIPAA', 'SOX', 'GDPR', 'GxP', 'QA', 'UX', 'UI',
  'IT', 'HR', 'GL', 'SOW', 'SOWs', 'MBA', 'BS', 'BA', 'MS', 'PhD', 'GPA',
  'TB', 'GB', 'MB', 'KB', 'PB', 'USD', 'EUR', 'GBP', 'US', 'USA', 'UK', 'EU',
  'DevOps', 'MLOps', 'IaC', 'VPC', 'DNS', 'CDN', 'ORM', 'CDC', 'OLAP', 'OLTP',
  'PDF', 'HTML', 'CSS', 'ATS', 'STAR', 'OKR', 'OKRs', 'P&L', 'CTO', 'CEO', 'CFO', 'CIO',
  'VBA', 'VP', 'SVP', 'EVP', 'JSONB', 'JSON', 'DORA', 'SPACE', 'DevEx',
  // US state/territory postal codes — standard in any "City, ST" address line,
  // never spelled out in practice on a resume or cover letter.
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
  // Standard English words that happen to be all-caps by convention, not
  // jargon abbreviations — nobody spells these out.
  'ZIP',
]);

/**
 * Candidate-specific additions (an alma mater's initials, a field-specific
 * acronym) belong to the user layer, not here — this file is system-layer and
 * gets replaced on update, and personal data in it contradicts the Data
 * Contract. Optional: `config/lint-allowlist.json`, either `["BYU", "CFA"]` or
 * `{"abbreviations": ["BYU", "CFA"]}`.
 *
 * Read once at module load. A malformed file is a warning, not a failure: a
 * broken allowlist should cost extra warnings, never block a CV from rendering.
 */
function loadUserAllowlist() {
  const path = new URL('./config/lint-allowlist.json', import.meta.url);
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed?.abbreviations;
    if (!Array.isArray(list)) {
      console.warn('⚠️  config/lint-allowlist.json: expected an array or {"abbreviations": [...]} — ignoring');
      return [];
    }
    return list.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim());
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️  config/lint-allowlist.json could not be read (${err.message}) — ignoring`);
    }
    return [];
  }
}

for (const token of loadUserAllowlist()) ALLOWED_ABBREVIATIONS.add(token);

const ABBREV_CANDIDATE_RE = /(?<![\w&])([A-Z][A-Z0-9&]{1,7})(?![\w&])/g;

// An abbreviation introduced properly — "Fast Healthcare Interoperability
// Resources (FHIR)" — is already spelled out, and flagging it anyway trains
// the operator to wave the whole check through. Matches a multi-word
// capitalized phrase immediately followed by the abbreviation in parentheses.
// Scanned over the WHOLE document, so an expansion in the summary covers a
// later bare use in a bullet: the checks below run on bullet text only, which
// is why the raw per-bullet scan could not see the expansion.
const ABBREV_EXPANSION_RE =
  /\b([A-Z][A-Za-z]+(?:[\s-][A-Za-z]+){1,6})\s*\(([A-Z][A-Z0-9&]{1,7})\)/g;

/**
 * Abbreviations the document itself defines on first use.
 * @param {string} text - Full document text.
 * @returns {Set<string>}
 */
export function expandedAbbreviations(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(ABBREV_EXPANSION_RE)) out.add(m[2]);
  return out;
}

const DATE_FIRST_RE =
  /^\s*(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}\b|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/;

const HAS_NUMBER_RE = /\d/;

// ── Metric strength ─────────────────────────────────────────────────
//
// A number on a resume bullet earns its place by conveying either notable
// SCALE or a CHANGE the candidate caused. A bullet whose only figures are
// small, static counts ("supported 5 users", "built 4 reports") reads as
// activity logging rather than impact, which is what the candidate wants
// caught before the document ships.
//
// This is deliberately a heuristic that surfaces bullets for human judgment.
// Whether a given number is impressive depends on the target role's peer
// group, which no regex can know — a script cannot decide that 50 users is
// modest for a platform role but meaningful for an internal tool.

// Numbers reading as large enough to carry scale on their own: >= 100, any
// magnitude-suffixed figure (10M, 1TB, 5K), any currency amount, or a
// percentage of 20 or more.
const LARGE_MAGNITUDE_RES = [
  /\$\s?\d/,                                   // currency
  /\d+(?:\.\d+)?\s?[KMB]\b/,                   // 10K / 1.2M / 3B
  /\d+(?:\.\d+)?\s?(?:[KMGTP]B)\b/i,           // 1TB / 500GB
  /\b(?:[1-9]\d{2,})\b/,                       // 100 and up
  /\b(?:[2-9]\d|\d{3,})\s?%/,                  // 20% and up
];

// Language indicating a delta the candidate caused. "replac\w*" is included
// because "replaced X with Y" is an unambiguous before/after claim even with
// no number attached to the "before" state.
const DELTA_RE =
  /\b(?:cut|cuts|cutting|reduc\w*|decreas\w*|increas\w*|improv\w*|sav\w*|avoid\w*|eliminat\w*|accelerat\w*|grew|grow\w*|scal\w*|boost\w*|doubl\w*|tripl\w*|halv\w*|shorten\w*|shrink\w*|shrank|rais\w*|lower\w*|replac\w*|from\s+[^,]*\bto\b)/i;

/**
 * Decide whether a bullet's numbers convey scale or change.
 * @param {string} bullet
 * @returns {boolean} true when the metric already carries weight
 */
export function metricIsSubstantive(bullet) {
  const text = String(bullet || '');
  if (LARGE_MAGNITUDE_RES.some(re => re.test(text))) return true;
  return DELTA_RE.test(text);
}

// ── Qualifier repetition ────────────────────────────────────────────
//
// A single "X+" is normal resume shorthand. A whole document built entirely
// out of them reads as templated rather than written — the candidate's own
// observation, 2026-08-20. Matches a leading digit through a trailing "+",
// allowing a magnitude/multiplier letter in between ("500+", "10M+", "10x+",
// "$350K+" matches from the "350K+" portion).
const PLUS_QUALIFIER_RE = /\d[\dA-Za-z]*\+/g;

// 3 or fewer reads as normal variation; four-plus starts to read as a tic.
const PLUS_QUALIFIER_THRESHOLD = 4;

function finding(rule, severity, message, context) {
  return { rule, severity, message, context: context ? context.slice(0, 120) : undefined };
}

/**
 * Lint one rendered document.
 * @param {string} html
 * @param {{kind?: 'resume'|'cover'}} [opts]
 * @returns {{findings: Array, counts: {error: number, warn: number}}}
 */
export function lintDocument(html, opts = {}) {
  const kind = opts.kind === 'cover' ? 'cover' : 'resume';
  const findings = [];
  const bullets = extractBullets(html);
  const text = htmlToText(html);

  // Ignore the contact/header block for pronoun and abbreviation checks: a
  // name or a location legitimately looks like neither prose nor a bullet.
  const prose = kind === 'cover' ? text : bullets.join(' \n ');

  if (kind === 'resume') {
    for (const m of prose.matchAll(PRONOUN_RE)) {
      findings.push(finding('pronoun', 'error',
        `First-person pronoun "${m[0]}" — resumes omit personal pronouns.`, m.input.slice(Math.max(0, m.index - 40), m.index + 40)));
    }
  }

  for (const m of prose.matchAll(PASSIVE_RE)) {
    findings.push(finding('passive', 'warn',
      `Possible passive voice: "${m[0]}" — prefer an action verb.`, m[0]));
  }

  for (const b of bullets) {
    const lower = b.toLowerCase();
    for (const weak of WEAK_OPENERS) {
      if (lower.startsWith(weak) || lower.includes(` ${weak}`)) {
        findings.push(finding('weak-verb', 'warn',
          `Weak phrasing "${weak}" — lead with a concrete action verb.`, b));
        break;
      }
    }
    if (kind === 'resume' && !HAS_NUMBER_RE.test(b)) {
      findings.push(finding('no-metric', 'warn',
        'Bullet carries no number — quantify the result if one exists.', b));
    } else if (kind === 'resume' && !metricIsSubstantive(b)) {
      findings.push(finding('weak-metric', 'warn',
        'Numbers are small and show no change — check this reads as impact, not activity. Rework with the candidate; never inflate the figure.', b));
    }
    if (DATE_FIRST_RE.test(b)) {
      findings.push(finding('date-first', 'warn',
        'Bullet starts with a date — lead with the action instead.', b));
    }
  }

  // Scanned over the full document text, not just `prose`: an expansion in the
  // Professional Summary must cover a later bare use inside a bullet.
  const introduced = expandedAbbreviations(text);
  const seenAbbrev = new Set();
  for (const m of prose.matchAll(ABBREV_CANDIDATE_RE)) {
    const token = m[1];
    if (ALLOWED_ABBREVIATIONS.has(token) || seenAbbrev.has(token) || introduced.has(token)) continue;
    seenAbbrev.add(token);
    findings.push(finding('abbreviation', 'warn',
      `"${token}" may not be industry-standard — spell it out on first use.`, m[0]));
  }

  if (kind === 'resume') {
    // Scoped to bullet text only (not the header/contact row), so an email
    // address using plus-addressing ("name+jobs@gmail.com") can never
    // contribute a false match.
    const plusMatches = bullets.join(' ').match(PLUS_QUALIFIER_RE) || [];
    if (plusMatches.length >= PLUS_QUALIFIER_THRESHOLD) {
      findings.push(finding('qualifier-repetition', 'warn',
        `"X+" appears ${plusMatches.length} times (${[...new Set(plusMatches)].join(', ')}) — mix in "over X" and "more than X" so the metrics don't all read the same way.`));
    }
  }

  if (kind === 'resume') {
    if (!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) {
      findings.push(finding('contact', 'error', 'No email address found — missing contact information.'));
    }
    if (!/(?:\+?\d[\d\s().-]{7,}\d)/.test(text)) {
      findings.push(finding('contact', 'warn', 'No phone number found — Harvard lists missing contact info as a top resume mistake.'));
    }
  }

  const counts = {
    error: findings.filter(f => f.severity === 'error').length,
    warn: findings.filter(f => f.severity === 'warn').length,
  };
  return { findings, counts };
}

/**
 * Compare a resume and cover letter's body type.
 * Harvard: "Ensure your resume and cover letter are prepared with the same
 * font type and size."
 */
export function lintFontPair(resumeHtml, coverHtml) {
  const a = extractBodyFont(resumeHtml);
  const b = extractBodyFont(coverHtml);
  const findings = [];
  if (a.family && b.family && a.family !== b.family) {
    findings.push(finding('font-pair', 'error',
      `Resume and cover letter use different fonts (${a.family} vs ${b.family}).`));
  }
  if (a.size && b.size && a.size !== b.size) {
    findings.push(finding('font-pair', 'warn',
      `Resume and cover letter use different body sizes (${a.size} vs ${b.size}).`));
  }
  return findings;
}

// ── CLI ─────────────────────────────────────────────────────────────

function render(findings, summaryMode) {
  if (!summaryMode) {
    console.log(JSON.stringify({
      findings,
      counts: {
        error: findings.filter(f => f.severity === 'error').length,
        warn: findings.filter(f => f.severity === 'warn').length,
      },
    }, null, 2));
    return;
  }
  console.log('\nResume Lint (Harvard MCS standards)');
  console.log('─'.repeat(48));
  if (findings.length === 0) {
    console.log('  No issues found.');
    return;
  }
  for (const f of findings) {
    const tag = f.severity === 'error' ? 'ERROR' : 'warn ';
    console.log(`  [${tag}] ${f.rule}: ${f.message}`);
    if (f.context) console.log(`          ${f.context}`);
  }
  const e = findings.filter(f => f.severity === 'error').length;
  const w = findings.length - e;
  console.log('─'.repeat(48));
  console.log(`  ${e} error(s), ${w} warning(s)`);
}

function runSelfTest() {
  let passed = 0, failed = 0;
  const eq = (label, actual, expected) => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
    else { failed++; console.log(`  FAIL: ${label}\n    expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  };
  const has = (res, rule) => res.findings.some(f => f.rule === rule);

  const clean = `<html><head><style>body { font-family: 'Times New Roman', serif; font-size: 10pt; }</style></head><body>
    <div>jane@example.com | (555) 123-4567</div>
    <ul><li>Engineered 12 pipelines processing 1TB daily, cutting latency 90%</li></ul>
  </body></html>`;
  const cleanRes = lintDocument(clean);
  eq('clean resume has no errors', cleanRes.counts.error, 0);
  eq('clean resume bullet is not flagged for metrics', has(cleanRes, 'no-metric'), false);

  const pronouns = clean.replace('Engineered 12', 'I engineered 12');
  eq('first-person pronoun is an error', has(lintDocument(pronouns), 'pronoun'), true);
  eq('pronoun check is skipped for cover letters',
    lintDocument(pronouns, { kind: 'cover' }).findings.some(f => f.rule === 'pronoun'), false);

  const passive = clean.replace('Engineered 12 pipelines', '12 pipelines were built');
  eq('passive voice is flagged', has(lintDocument(passive), 'passive'), true);

  const proactiveIdiom = clean.replace('Engineered 12 pipelines processing 1TB daily, cutting latency 90%',
    'Delivered schema documentation without being asked, cutting onboarding time in half');
  eq('"without being X" proactivity idiom is not flagged as passive', has(lintDocument(proactiveIdiom), 'passive'), false);

  eq('JSONB is not flagged as a non-standard abbreviation',
    has(lintDocument(clean.replace('1TB daily', '1TB of JSONB data daily')), 'abbreviation'), false);

  eq('US state postal code (UT) in a "City, ST" line is not flagged',
    has(lintDocument(clean.replace('(555) 123-4567', 'Lehi, UT | (555) 123-4567')), 'abbreviation'), false);
  eq('a second state code (NY) is also not flagged',
    has(lintDocument(clean.replace('(555) 123-4567', 'New York, NY | (555) 123-4567')), 'abbreviation'), false);
  eq('BYU (candidate\'s alma mater) is not flagged',
    has(lintDocument(clean.replace('1TB daily', '1TB daily, BYU-certified')), 'abbreviation'), false);
  eq('ZIP (as in ZIP code, standard English) is not flagged',
    has(lintDocument(clean.replace('1TB daily', 'matching on ZIP code prefix')), 'abbreviation'), false);

  const weak = clean.replace('Engineered 12', 'Responsible for 12');
  eq('weak opener is flagged', has(lintDocument(weak), 'weak-verb'), true);

  const noMetric = clean.replace('Engineered 12 pipelines processing 1TB daily, cutting latency 90%', 'Engineered data pipelines');
  eq('bullet without a number is flagged', has(lintDocument(noMetric), 'no-metric'), true);

  const dateFirst = clean.replace('Engineered 12', '2024 delivered 12');
  eq('date-first bullet is flagged', has(lintDocument(dateFirst), 'date-first'), true);

  // weak-metric: small static counts are surfaced, scale and deltas are not.
  const mk = bullet => clean.replace('Engineered 12 pipelines processing 1TB daily, cutting latency 90%', bullet);
  eq('small static count is flagged', has(lintDocument(mk('Supported 5 users across 3 teams')), 'weak-metric'), true);
  eq('a delta is not flagged', has(lintDocument(mk('Cut report runtime from 4 hours to 8 minutes')), 'weak-metric'), false);
  eq('a large count is not flagged', has(lintDocument(mk('Modeled 500 warehouse tables for reporting')), 'weak-metric'), false);
  eq('a magnitude suffix is not flagged', has(lintDocument(mk('Migrated 1.2M records into the platform')), 'weak-metric'), false);
  eq('a currency figure is not flagged', has(lintDocument(mk('Directed $350K in annual engagements')), 'weak-metric'), false);
  eq('a byte-scale figure is not flagged', has(lintDocument(mk('Partitioned 5TB of event data for query pruning')), 'weak-metric'), false);
  eq('a small percentage alone is flagged', has(lintDocument(mk('Held error rate at 3% across 2 services')), 'weak-metric'), true);
  eq('weak-metric never double-reports a bullet with no numbers at all',
    lintDocument(mk('Engineered data pipelines')).findings.filter(f => f.rule === 'weak-metric').length, 0);
  eq('weak-metric is skipped for cover letters',
    has(lintDocument(mk('Supported 5 users across 3 teams'), { kind: 'cover' }), 'weak-metric'), false);

  eq('allowlisted abbreviation is not flagged', has(lintDocument(clean), 'abbreviation'), false);

  // An abbreviation the document spells out on first use is already introduced,
  // even when the expansion is in a different section from the bare use.
  const expandedInline = clean.replace('1TB daily',
    'a Fast Healthcare Interoperability Resources (FHIR) feed daily');
  eq('an abbreviation expanded on first use is not flagged',
    has(lintDocument(expandedInline), 'abbreviation'), false);

  const expandedInSummary = `<html><head><style>body { font-family: 'Times New Roman', serif; font-size: 10pt; }</style></head><body>
    <div>jane@example.com | (555) 123-4567</div>
    <p>Ingests Fast Healthcare Interoperability Resources (FHIR) feeds.</p>
    <ul><li>Engineered 12 FHIR pipelines processing 1TB daily, cutting latency 90%</li></ul>
  </body></html>`;
  eq('expansion in a prose section covers a bare use in a later bullet',
    has(lintDocument(expandedInSummary), 'abbreviation'), false);

  const neverExpanded = clean.replace('1TB daily', '1TB of ZQXW daily');
  eq('an abbreviation never expanded anywhere is still flagged',
    has(lintDocument(neverExpanded), 'abbreviation'), true);
  const oddAbbrev = clean.replace('Engineered 12 pipelines', 'Engineered 12 ZQXW pipelines');
  eq('non-standard abbreviation is flagged', has(lintDocument(oddAbbrev), 'abbreviation'), true);

  const noEmail = clean.replace('jane@example.com | ', '');
  eq('missing email is an error', noEmail.includes('@'), false);
  eq('missing email produces a contact error', lintDocument(noEmail).findings.some(f => f.rule === 'contact' && f.severity === 'error'), true);

  // qualifier-repetition: 4+ uses of "X+" across bullets is flagged; a mix
  // of "X+" with "over X"/"more than X" phrasing is not, and email
  // plus-addressing in the header never counts.
  const repetitive = `<html><head><style>body { font-family: 'Times New Roman', serif; font-size: 10pt; }</style></head><body>
    <div>jane+jobs@example.com | (555) 123-4567</div>
    <ul>
      <li>Led 10+ engineers across 15+ teams</li>
      <li>Cut latency for 500+ services</li>
      <li>Migrated 10M+ rows across 20+ pipelines</li>
    </ul>
  </body></html>`;
  eq('4+ uses of the same qualifier pattern is flagged', has(lintDocument(repetitive), 'qualifier-repetition'), true);

  const varied = repetitive
    .replace('Led 10+ engineers across 15+ teams', 'Led more than 10 engineers across 15+ teams')
    .replace('Cut latency for 500+ services', 'Cut latency for over 500 services')
    .replace('Migrated 10M+ rows across 20+ pipelines', 'Migrated over 10 million rows across 20+ pipelines');
  eq('mixed qualifier phrasing is not flagged', has(lintDocument(varied), 'qualifier-repetition'), false);
  eq('qualifier check ignores plus-addressing in the email header',
    lintDocument(varied).findings.some(f => f.rule === 'qualifier-repetition'), false);

  const coverSans = `<html><head><style>body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; }</style></head><body><p>Text.</p></body></html>`;
  eq('mismatched CV/cover fonts are an error',
    lintFontPair(clean, coverSans).some(f => f.rule === 'font-pair' && f.severity === 'error'), true);
  eq('matching CV/cover fonts pass', lintFontPair(clean, clean).length, 0);

  console.log(`\nresume-lint self-test: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    runSelfTest();
  } else {
    const summaryMode = args.includes('--summary');
    const coverIdx = args.indexOf('--cover');
    const coverPath = coverIdx !== -1 ? args[coverIdx + 1] : null;
    const isCoverOnly = args.includes('--kind=cover');
    const target = args.find((a, i) => !a.startsWith('--') && a !== coverPath);

    if (!target || !existsSync(target)) {
      console.error('Usage: node resume-lint.mjs <built.html> [--summary] [--cover <cover.html>] [--kind=cover]');
      console.error('       node resume-lint.mjs --self-test');
      process.exit(1);
    }

    const html = readFileSync(target, 'utf-8');
    const { findings } = lintDocument(html, { kind: isCoverOnly ? 'cover' : 'resume' });

    if (coverPath) {
      if (!existsSync(coverPath)) {
        console.error(`Cover letter not found: ${coverPath}`);
        process.exit(1);
      }
      findings.push(...lintFontPair(html, readFileSync(coverPath, 'utf-8')));
    }

    render(findings, summaryMode);
    process.exit(findings.some(f => f.severity === 'error') ? 1 : 0);
  }
}
