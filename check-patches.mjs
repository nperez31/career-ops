#!/usr/bin/env node

/**
 * check-patches.mjs — verify the local customizations still exist in the
 * system-layer files that `update-system.mjs apply` overwrites.
 *
 * The CV/cover pipeline's quality gates live inside system-layer files
 * (`modes/pdf.md`, `modes/cover.md`, `generate-pdf.mjs`, ...). The Data
 * Contract is explicit that those get replaced wholesale on update, and the
 * updater has no way to know a local edit was load-bearing. Without this check
 * an update silently removes the lint gate, the metric grading step, and the
 * page-fill gate, and the next CV renders with none of them — quietly, because
 * nothing errors when a numbered step simply is not there any more.
 *
 * This does NOT re-apply anything. Git holds the actual content (each patched
 * file is committed), so recovery is a normal diff-and-merge against the new
 * upstream version — a merge that needs judgment, because the upstream change
 * that overwrote the file may itself be worth keeping. This script only answers
 * "is anything missing", which is the part that is easy to not notice.
 *
 * Run it after every `node update-system.mjs apply`.
 *
 * Usage:
 *   node check-patches.mjs            # JSON
 *   node check-patches.mjs --summary  # human-readable
 *   node check-patches.mjs --self-test
 *
 * Exit 1 if any patch is missing.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * Each entry is one local customization, identified by a sentinel string that
 * only exists because of that customization. Sentinels are chosen to be
 * specific (a filename or an exported identifier), not prose that upstream
 * might coincidentally introduce or that a reword would break.
 */
export const PATCHES = [
  { file: 'modes/pdf.md', sentinel: 'resume-lint.mjs', what: 'Step 18b — standards gate' },
  { file: 'modes/pdf.md', sentinel: 'metric-impact.md', what: 'Step 18c — metric impact grading' },
  { file: 'modes/pdf.md', sentinel: 'check-page-fill.mjs', what: 'Step 18d — page-fill gate' },
  { file: 'modes/pdf.md', sentinel: 'harvard-resume.md', what: 'Steps 8b / 19b / 19c — language standards + closing gates' },
  { file: 'modes/pdf.md', sentinel: 'build-cv-docx.mjs', what: 'Step 20 — editable .docx copy' },
  { file: 'modes/cover.md', sentinel: 'achievements_prose', what: 'Step 7 — prose-default achievements' },
  { file: 'modes/cover.md', sentinel: 'harvard-resume.md', what: 'Cover-letter structure + font-pair rule' },
  { file: 'generate-pdf.mjs', sentinel: 'resolvePageMargin', what: 'Template page_margin metadata (check-page-fill.mjs imports this)' },
  { file: 'generate-pdf.mjs', sentinel: 'templateFixesSectionOrder', what: 'Template section_order: fixed metadata' },
  { file: 'generate-cover-letter.mjs', sentinel: 'achievements_prose', what: 'Prose achievements rendering' },
  { file: 'build-cv-html.mjs', sentinel: 'dropSection', what: 'Order-independent optional-section removal' },
  { file: 'build-cv-html.mjs', sentinel: 'LEADERSHIP', what: 'Leadership & Service section' },
  { file: 'jd-skill-gap.mjs', sentinel: 'splitSkillsSection', what: 'Skills-section splitter export (resume-skill-diff.mjs imports this)' },
  { file: 'test-all.mjs', sentinel: 'resume-lint.mjs --self-test', what: 'Gate self-tests registered in the suite' },
];

/** Files that are wholly ours — if one is gone, something deleted it. */
export const LOCAL_FILES = [
  'resume-lint.mjs',
  'check-page-fill.mjs',
  'build-cv-docx.mjs',
  'resume-skill-diff.mjs',
  'modes/skill-import.md',
  'modes/heuristics/harvard-resume.md',
  'modes/heuristics/metric-impact.md',
  'modes/_custom.md',
];

/**
 * @param {(p: string) => string|null} read - returns file contents or null if absent
 * @returns {{ok: boolean, missing: Array, present: number}}
 */
export function verify(read) {
  const missing = [];
  let present = 0;

  for (const p of PATCHES) {
    const content = read(p.file);
    if (content === null) missing.push({ ...p, reason: 'file not found' });
    else if (!content.includes(p.sentinel)) missing.push({ ...p, reason: 'sentinel absent — patch was overwritten' });
    else present++;
  }

  for (const f of LOCAL_FILES) {
    if (read(f) === null) missing.push({ file: f, sentinel: null, what: 'local file', reason: 'file not found' });
    else present++;
  }

  return { ok: missing.length === 0, missing, present };
}

function readFromDisk(rel) {
  const abs = join(ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf-8') : null;
}

function runSelfTest() {
  let passed = 0, failed = 0;
  const eq = (label, actual, expected) => {
    if (actual === expected) passed++;
    else { failed++; console.log(`  FAIL: ${label} — expected ${expected}, got ${actual}`); }
  };

  const allPresent = verify(() => PATCHES.map(p => p.sentinel).join('\n'));
  eq('all sentinels present => ok', allPresent.ok, true);

  const overwritten = verify(rel => (rel === 'modes/pdf.md' ? 'upstream content with no local edits' : PATCHES.map(p => p.sentinel).join('\n')));
  eq('overwritten file is reported', overwritten.missing.some(m => m.file === 'modes/pdf.md'), true);
  eq('overwritten file reports the right reason',
    overwritten.missing.find(m => m.file === 'modes/pdf.md').reason.includes('overwritten'), true);

  const deleted = verify(rel => (rel === 'resume-lint.mjs' ? null : PATCHES.map(p => p.sentinel).join('\n')));
  eq('deleted local file is reported', deleted.missing.some(m => m.file === 'resume-lint.mjs'), true);

  console.log(`\ncheck-patches self-test: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    const result = verify(readFromDisk);
    if (!process.argv.includes('--summary')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\nLocal customization check');
      console.log('─'.repeat(52));
      if (result.ok) {
        console.log(`  All ${result.present} customizations present.`);
      } else {
        for (const m of result.missing) {
          console.log(`  MISSING  ${m.file}`);
          console.log(`           ${m.what} — ${m.reason}`);
        }
        console.log('─'.repeat(52));
        console.log(`  ${result.missing.length} missing, ${result.present} present.`);
        console.log('  Recover with: git diff <file>  then merge the local edits back in.');
      }
    }
    process.exit(result.ok ? 0 : 1);
  }
}
