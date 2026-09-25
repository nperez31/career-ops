# Recreating This Setup on a Fresh Clone

A runbook for rebuilding the enhanced career-ops pipeline in a new repo. Assumes you have the 13 carry-over files from an existing setup.

**Time:** ~30 minutes, most of it agent time.
**Companion doc:** `WORKFLOW-BLUEPRINT.md` — the *what and why*. This file is the *how, in order*.

---

## The principle

The carry-over files are **finished work**. They are already candidate-agnostic — no names, employers, or contact details. Do not let an agent rebuild them from the blueprint's specifications; that path is slower, costs far more tokens, and produces a slightly different system every time.

The agent's job is narrow: apply the **system-layer patches** (blueprint §6 and §7) to files the fresh clone ships its own copies of. That is the only part that genuinely cannot be copied.

---

## Step 1 — Clone and onboard

```bash
git clone https://github.com/santifer/career-ops.git
cd career-ops
npm install
npx playwright install chromium
```

Start a session and complete stock onboarding — `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`. Confirm:

```bash
node doctor.mjs --json
```

`onboardingNeeded` must be `false` before continuing. The patches in Step 3 assume an onboarded repo.

---

## Step 2 — Copy the 13 files

Place each at the path shown. Directories `modes/heuristics/` and `config/` already exist in a stock clone.

### Process and standards (5)

| File | Destination | Notes |
|---|---|---|
| `WORKFLOW-BLUEPRINT.md` | root | The agent reads this in Step 3 |
| `modes/_custom.md` | `modes/` | **Needs one edit — see below** |
| `modes/skill-import.md` | `modes/` | Old-resume skill importer mode |
| `modes/heuristics/harvard-resume.md` | `modes/heuristics/` | Document language standards |
| `modes/heuristics/metric-impact.md` | `modes/heuristics/` | Metric grading + rework protocol |

### Enforcement scripts (5)

| File | Destination | Notes |
|---|---|---|
| `resume-lint.mjs` | root | Mechanical standards gate |
| `check-page-fill.mjs` | root | One-page fill gate (85–100%) |
| `check-patches.mjs` | root | Update-survival checker |
| `resume-skill-diff.mjs` | root | Zero-LLM old-resume differ |
| `build-cv-docx.mjs` | root | Editable Word output |

### Template and config (3)

| File | Destination | Notes |
|---|---|---|
| `templates/cv-template.marriott.html` | `templates/` | Optional — see Step 6 |
| `templates/cover-letter-template.marriott.html` | `templates/` | Must pair with the CV template |
| `config/lint-allowlist.json` | `config/` | **Personal** — replace contents with your own initialisms |

### The one required edit

`modes/_custom.md` contains a confidentiality house rule that names a specific employer. Find the rule beginning **"Never name a consulting client"** and replace the employer name with a generic reference ("the user's consulting clients"). Everything else in the file is portable as-is.

Also open `config/lint-allowlist.json` and replace the `abbreviations` array with initialisms that are standard for *you* — schools, certifications, field-specific acronyms the linter should never flag for spell-out. An empty array is fine.

---

## Step 3 — Hand it to Claude

Paste this verbatim:

```
This repo is a fresh career-ops clone. I've dropped in a set of files from a
previous setup that I want reproduced here exactly.

Read WORKFLOW-BLUEPRINT.md first, in full, before doing anything else.

Important: the following are ALREADY DONE and copied in. Do not rebuild,
regenerate, or "improve" them — verify they exist and move on:
  resume-lint.mjs, check-page-fill.mjs, check-patches.mjs,
  resume-skill-diff.mjs, build-cv-docx.mjs, modes/skill-import.md,
  modes/_custom.md, modes/heuristics/harvard-resume.md,
  modes/heuristics/metric-impact.md, templates/cv-template.marriott.html,
  templates/cover-letter-template.marriott.html

Your actual job is §6 and §7 only: apply the system-layer patches to
modes/pdf.md, modes/cover.md, generate-pdf.mjs, generate-cover-letter.mjs,
build-cv-html.mjs, jd-skill-gap.mjs, and test-all.mjs.

The blueprint was written against v1.29.0 and this clone is likely newer, so
do NOT pattern-match the patch text literally. For each patch, read the
current file, work out where the change belongs in THIS version, and tell me
if upstream has since changed something that makes a patch redundant or wrong.
Flag it rather than forcing it in.

Then, in order:
  1. node doctor.mjs --json  — finish onboarding if anything is missing
  2. node resume-lint.mjs --self-test
     node check-page-fill.mjs --self-test
     node check-patches.mjs --self-test
     node resume-skill-diff.mjs --self-test
  3. node check-patches.mjs --summary  — must report all customizations present
  4. node test-all.mjs  — report any failures, don't paper over them
  5. Set cv.template and cover.template to "marriott" in config/profile.yml
  6. Create data/skill-verification.tsv and data/interest-signals.tsv with
     their header rows (blueprint §9)

Constraints:
- Never write a factual claim into cv.md that I didn't state. §1 principle 4
  and §4.2 govern this — a gap is a question for me, never a silent fix.
- Stop and ask before generating any application document.
- Show me the §6/§7 diffs before applying them.
```

### Why the "don't pattern-match literally" paragraph matters

It is the single most important line in the prompt. Without it, an agent tries to insert Step 18b next to blueprint text that upstream has since reworded, the insertion lands in the wrong place or silently fails, and you get a half-applied gate sequence. The Step 3 verification below exists to catch exactly that.

---

## Step 4 — Verify

Run these yourself after the agent reports done. Do not take "all set" on faith.

```bash
node check-patches.mjs --summary
```

Expected: **all customizations present** — 14 patch sentinels across the system-layer files, plus 8 local files. Anything in the `missing` list means a patch did not land; have the agent re-derive that one specifically rather than rerunning the whole job.

```bash
node test-all.mjs
```

Some upstream tests may fail for reasons unrelated to these patches. Read the failures — a failure naming one of the seven patched files is yours to fix; a failure elsewhere is upstream's and can be reported rather than chased.

```bash
node resume-lint.mjs --self-test
node check-page-fill.mjs --self-test
node check-patches.mjs --self-test
node resume-skill-diff.mjs --self-test
```

All four must exit zero. These test the copied scripts against fixtures, so a failure here means a file was truncated or corrupted in transit, not that a patch is wrong.

---

## Step 5 — Smoke-test on one real posting

The verification above proves the parts exist. This proves they fire in sequence. Paste one real job URL and watch for four specific things:

1. **The gap conversation happens.** `jd-skill-gap.mjs` finds something not in `cv.md`, and the agent *asks you about it* rather than noting it as a gap in the report or quietly omitting it. This is the behavior that makes the whole system work — if it does not fire, the §6.1 patch to `modes/pdf.md` did not land.
2. **The metric grading table appears** before the render, weakest bullet first, with Strong rows included.
3. **Both gates run** — `resume-lint.mjs` and `check-page-fill.mjs`, by name, in the numbered sequence.
4. **Page fill lands in 85–100%.** First render is often over; note that word-level trims barely move this number. It moves in line-height increments, so only cutting whole bullets changes it meaningfully.

---

## Step 6 — Optional: skip the custom template

The template pair is the one purely *stylistic* carry-over. Everything else is process. If you drop it:

- Stock `templates/cv-template.html` renders instead — different look, all gates still run
- `build-cv-docx.mjs` only knows the Marriott layout, so `.docx` output stays Marriott-styled regardless of your PDF template
- Blueprint **§7.2's `section_order: fixed` patch becomes unnecessary** — it exists solely so a fixed-order template can bypass the section-order guard. Tell the agent to skip it.

Keep the template if you want the same-looking resume. The page-fill gate is calibrated against its specific margins, so a different template means re-forming your intuition for what "94% fill" looks like on the page.

---

## Step 7 — Back it up before you use it

Stock career-ops gitignores the entire user layer, which is correct when `origin` is the public upstream. If your new repo is **private**, that default leaves your most expensive files backed up nowhere.

Un-ignore at minimum:

```
modes/_custom.md
modes/_profile.md
config/profile.yml
config/lint-allowlist.json
cv.md
```

Leave `output/`, `data/pdf-index.tsv`, and generated PDFs ignored — they rebuild from source. `reports/` and `data/applications.md` are a judgment call: valuable history, but they churn constantly and carry company-specific notes.

---

## After every system update, forever

```bash
node update-system.mjs apply
node check-patches.mjs --summary     # ← never skip this
```

`update-system.mjs` overwrites system-layer files, which silently deletes the §6 and §7 patches. `check-patches.mjs` is what turns that from a bug you discover three resumes later into a line of output you see immediately.

When it reports something missing, **merge the patch back in — do not `git checkout` the file.** Checking out reverts the upstream improvements you just pulled. Re-apply the single patch by hand.

---

## What to do when something is missing

| Symptom | Cause | Fix |
|---|---|---|
| `check-patches` reports a `modes/*.md` sentinel missing | Patch never landed, or an update overwrote it | Re-derive that one patch against the current file |
| `check-patches` reports a local file missing | File not copied, or copied to the wrong path | Copy it; paths are in Step 2 |
| Gap conversation never fires | §6.1 `modes/pdf.md` patch missing | Most common failure — check Step 8b specifically |
| Page fill reads 0% or errors | `resolvePageMargin` not exported from `generate-pdf.mjs` | §7.2 patch incomplete |
| Linter flags your own initialisms | `config/lint-allowlist.json` still holds someone else's | Replace the `abbreviations` array |

---

*This runbook describes process only. Every factual claim in any document this system generates comes from your own user-layer files or from statements you make directly in conversation — never from this file, the blueprint, or inference.*
