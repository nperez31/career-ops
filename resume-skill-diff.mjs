#!/usr/bin/env node

/**
 * resume-skill-diff.mjs — Zero-LLM skill importer for an old resume/CV.
 *
 * Extracts skill-looking tokens from a resume file the candidate wrote
 * previously (any past resume, LinkedIn export, or one-off CV variant) and
 * diffs them against the canonical cv.md, so skills that only ever made it
 * into an old document can be surfaced for the candidate to confirm before
 * they're added to cv.md.
 *
 * Unlike jd-skill-gap.mjs (which only scans a JD's "Requirements" block —
 * conservative on purpose, since under-reporting there is safe and
 * over-reporting misreports a gap as real), this scans the ENTIRE old
 * resume. Over-extraction here is fine: every candidate token is reviewed
 * by the user before anything touches cv.md — nothing is ever auto-added
 * (same non-fabrication rule as jd-skill-gap.mjs and the rest of the
 * project; see AGENTS.md Source-of-Truth Boundary).
 *
 * Classification (against cv.md):
 *   alreadyNamed   — already a named skill in cv.md's Skills section
 *   alreadyInProse — not a named skill, but appears in prose elsewhere in cv.md
 *   candidate      — found in the old resume, absent from cv.md entirely —
 *                    the list worth showing the user
 *
 * Usage:
 *   node resume-skill-diff.mjs old-resumes/2024-resume.md
 *   node resume-skill-diff.mjs old-resumes/2024-resume.md --summary
 *   node resume-skill-diff.mjs --self-test
 *
 * PDF/DOCX input: this script only reads plain text/markdown (no parser
 * dependency in this project). For a PDF or Word resume, have the agent
 * read the file first (Read tool handles PDFs) and save the extracted text
 * to a .txt/.md file, then pass that path here.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { skillMentionedInText, splitSkillsSection } from './jd-skill-gap.mjs';

// ── Config ──────────────────────────────────────────────────────────

const CV_PATH = 'cv.md';

// Same token shape as jd-skill-gap.mjs's SKILL_TOKEN_RE (capitalized,
// technical-looking tokens with symbol-edge boundary handling for C#/C++/F#)
// but applied to the whole document rather than gated behind a
// "Requirements:" header, since resumes list skills under many different
// headings ("Skills", "Technologies", "Core Competencies") or bury them
// inline in experience bullets.
const SKILL_TOKEN_RE = /\b([A-Z][A-Za-z0-9+.#]{0,29}[A-Za-z0-9+#](?:\.[a-z]{2,4})?)(?!\w)/g;

// Broader than jd-skill-gap.mjs's STOPWORDS: resumes are full of capitalized
// non-skill boilerplate (section headers, month names, city/state names,
// company-generic words) that a JD's "Requirements:" block mostly avoids.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'this', 'that', 'these', 'those',
  'must', 'able', 'ability', 'strong', 'excellent', 'proven', 'a', 'an', 'or', 'in', 'of', 'to', 'as', 'is', 'are',
  'bachelor', 'bachelors', 'master', 'masters', 'degree', 'diploma', 'certification', 'certificate',
  'experience', 'years', 'year', 'senior', 'junior', 'entry', 'level', 'minimum', 'preferred', 'required',
  'candidates', 'candidate', 'applicants', 'applicant', 'ideal', 'successful',
  'knowledge', 'understanding', 'familiarity', 'exposure', 'background',
  'skills', 'skill', 'communication', 'team', 'teams', 'work', 'working',
  // resume-boilerplate additions
  'summary', 'profile', 'objective', 'education', 'certifications', 'leadership', 'interests',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'present', 'current', 'references', 'available', 'request',
]);

/**
 * Extract candidate skill tokens from an entire resume document (no header
 * gating — see file header for why).
 * @param {string} resumeText
 * @returns {string[]}
 */
function extractResumeSkills(resumeText) {
  const skills = new Set();
  let m;
  SKILL_TOKEN_RE.lastIndex = 0;
  while ((m = SKILL_TOKEN_RE.exec(resumeText)) !== null) {
    const token = m[1].trim();
    if (!STOPWORDS.has(token.toLowerCase()) && token.length > 1) {
      skills.add(token);
    }
  }
  return [...skills];
}

// ── Classification ───────────────────────────────────────────────────

/**
 * Classify each old-resume skill token against cv.md.
 * @param {string[]} resumeSkills
 * @param {string} cvText
 * @returns {{alreadyNamed: string[], alreadyInProse: string[], candidate: string[]}}
 */
function classifyResumeSkills(resumeSkills, cvText) {
  const { namedSkillsText, proseText } = splitSkillsSection(cvText);

  const alreadyNamed = [];
  const alreadyInProse = [];
  const candidate = [];

  for (const skill of resumeSkills) {
    if (skillMentionedInText(skill, namedSkillsText)) {
      alreadyNamed.push(skill);
    } else if (skillMentionedInText(skill, proseText)) {
      alreadyInProse.push(skill);
    } else {
      candidate.push(skill);
    }
  }

  return { alreadyNamed, alreadyInProse, candidate };
}

// ── Exports (for test-all.mjs and other consumers) ───────────────────
export { extractResumeSkills, classifyResumeSkills };

// ── CLI ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const summaryMode = args.includes('--summary');
const selfTestMode = args.includes('--self-test');
const resumePathArg = args.find(a => !a.startsWith('--'));

function runSelfTest() {
  let passed = 0, failed = 0;
  const eq = (label, actual, expected) => {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) {
      passed++;
    } else {
      failed++;
      console.log(`  FAIL: ${label}\n    expected: ${e}\n    actual:   ${a}`);
    }
  };

  const fakeOldResume = `
# Jane Doe

## Skills
Python, Kubernetes, Terraform, GCP, BigQuery

## Experience
Built ETL pipelines on Snowflake and wrote Go microservices.
Bachelor's degree in Computer Science, May 2019.
`;
  const fakeCv = `
# Skills
Python, Snowflake, dbt

# Experience
Deployed services onto Kubernetes clusters.
`;

  const resumeSkills = extractResumeSkills(fakeOldResume);
  eq('extracts Python from old-resume Skills section', resumeSkills.includes('Python'), true);
  eq('extracts GCP from old-resume Skills section', resumeSkills.includes('GCP'), true);
  eq('extracts Go from experience prose', resumeSkills.includes('Go'), true);
  eq('does not extract "Bachelor" as a skill', resumeSkills.includes('Bachelor'), false);
  eq('does not extract "May" (month) as a skill', resumeSkills.includes('May'), false);

  const result = classifyResumeSkills(['Python', 'Snowflake', 'Kubernetes', 'Terraform', 'GCP'], fakeCv);
  eq('Python classified as alreadyNamed (named skill in cv.md)', result.alreadyNamed.includes('Python'), true);
  eq('Snowflake classified as alreadyNamed', result.alreadyNamed.includes('Snowflake'), true);
  eq('Kubernetes classified as alreadyInProse (prose only, not named)', result.alreadyInProse.includes('Kubernetes'), true);
  eq('Terraform classified as a real candidate addition', result.candidate.includes('Terraform'), true);
  eq('GCP classified as a real candidate addition', result.candidate.includes('GCP'), true);

  // Symbol-edge tokens (C#/C++/F#) must extract standalone, same fix as
  // jd-skill-gap.mjs's SKILL_TOKEN_RE.
  const symbolEdgeResume = `## Skills\nC#, C++, F# and Docker.`;
  const symbolEdgeSkills = extractResumeSkills(symbolEdgeResume);
  eq('extracts C# standalone (symbol-edge boundary)', symbolEdgeSkills.includes('C#'), true);
  eq('extracts C++ standalone (symbol-edge boundary)', symbolEdgeSkills.includes('C++'), true);
  eq('sentence-ending token stays clean ("Docker", not "Docker.")', symbolEdgeSkills.includes('Docker'), true);

  console.log(`\nresume-skill-diff self-test: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
if (selfTestMode) {
  runSelfTest();
} else {
  if (!resumePathArg || !existsSync(resumePathArg)) {
    console.error('Usage: node resume-skill-diff.mjs <old-resume-file.md|.txt> [--summary]');
    console.error('       node resume-skill-diff.mjs --self-test');
    console.error('Note: plain text/markdown only. For a PDF/DOCX resume, have the agent');
    console.error('extract the text first and save it to a .txt/.md file.');
    process.exit(1);
  }
  if (!existsSync(CV_PATH)) {
    console.error(`Error: ${CV_PATH} not found — this is a user-layer file, create it first.`);
    process.exit(1);
  }

  const resumeText = readFileSync(resumePathArg, 'utf-8');
  const cvText = readFileSync(CV_PATH, 'utf-8');
  const resumeSkills = extractResumeSkills(resumeText);
  const result = classifyResumeSkills(resumeSkills, cvText);

  if (summaryMode) {
    console.log(`\nResume Skill Diff — ${resumePathArg} vs cv.md`);
    console.log('─'.repeat(40));
    console.log(`Tokens found in old resume: ${resumeSkills.length}`);
    console.log(`  Already named in cv.md Skills:   ${result.alreadyNamed.join(', ') || '(none)'}`);
    console.log(`  Already in cv.md prose:          ${result.alreadyInProse.join(', ') || '(none)'}`);
    console.log(`  Candidate additions (not in cv.md at all): ${result.candidate.join(', ') || '(none)'}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
} // end CLI guard
