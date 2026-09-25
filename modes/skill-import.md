# Mode: skill-import — Import Skills from an Old Resume/CV

When the candidate wants to check an old resume, past CV, or LinkedIn export for skills that never made it into `cv.md`.

## Step 1 — Get the old document as text

If the candidate gave a path to a `.md`/`.txt` file, use it directly. If it's a PDF or Word doc, read it with the Read tool (handles PDFs), save the extracted text to a temp file (e.g. `output/old-resume-extract.md`, gitignored), and use that path.

## Step 2 — Run the diff

```bash
node resume-skill-diff.mjs <path> --summary
```

This is zero-LLM and deterministic (see `resume-skill-diff.mjs` header) — it only extracts tokens and diffs them against `cv.md`. It never writes anything.

Ignore `alreadyNamed` and `alreadyInProse` — those are already covered. The list that matters is `candidate`: tokens found in the old document that don't appear anywhere in `cv.md`.

## Step 3 — Filter noise before showing the user

The extractor is deliberately broad (unlike `jd-skill-gap.mjs`, it scans the whole document, not just a requirements block), so `candidate` will contain non-skill noise: company names, project names, city names, acronyms that aren't tools. Use judgment to drop obvious noise before presenting the list — don't make the user wade through it.

## Step 4 — Confirm with the user, one batch

Present the filtered candidate list and ask which ones are real, current skills worth adding — same spirit as onboarding's skill-verification step. Never add a skill without explicit confirmation (Source-of-Truth Boundary, AGENTS.md: "Keywords get reformulated, never fabricated").

For each confirmed skill, also ask (or accept if already offered) a one-line note on where/how it was used — this matches the existing `data/skill-verification.tsv` convention of logging "has, description pending" and following up. Don't block adding the skill on getting the description; missing context can stay pending.

## Step 5 — Write the results

- **Confirmed skills** → append to `cv.md`'s Technical Skills section, in the most fitting existing category line (e.g. a cloud platform goes on the `Data Engineering:` line). Never create a new category for one skill without asking. This is the one case in this mode that edits `cv.md` directly — it's a user-layer file and the edit is explicitly confirmed, so it doesn't go through the tracker-additions TSV path (that path is for tracker rows, not CV content).
- **Log the source** → append a row to `data/skill-verification.tsv` (create with the existing header if missing) with `source_job` set to `resume-import:{old-file-basename}` so it's traceable later, same format as existing rows.
- **Declined or uncertain skills** → drop them, no record needed. Silence beats a manufactured entry.

## Step 6 — Confirm

Tell the candidate what was added to `cv.md` and what was skipped. Suggest re-running `node cv-sync-check.mjs` if any downstream reports reference stale skill state.
