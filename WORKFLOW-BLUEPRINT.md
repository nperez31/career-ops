# Career-Ops Workflow Blueprint

**Purpose:** reproduce, on a fresh `career-ops` clone, the enhanced evaluation → tailoring → generation workflow described here. Everything in this document is candidate-agnostic and role-agnostic: it describes *how the process runs*, never who is running it or what they are applying for.

**How to use it:** drop this file in the root of the new clone and tell the agent to read it, or paste it as instructions at the start of the session. Then work through §13 (Setup Checklist). Nothing here requires the original repo.

**What it assumes:** a stock `career-ops` clone at v1.29.0 or later, already onboarded (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml` exist).

---

## 1. Design principles

Six ideas generate every specific rule below. When a situation arises that this document does not cover, decide from these.

1. **A gap is a hypothesis, not a fact.** Any tool that says "the candidate lacks X" has only proven that X is not *documented*. The candidate may well have X. The correct response is a question to the candidate, never a note in a report and never a silent omission.

2. **Capture once, reuse forever.** Every fact the candidate supplies mid-conversation — a skill, a metric, a scope detail — gets written back into `cv.md` (or the appropriate user-layer file) in the same turn. The same question must never be asked twice across sessions. This is what turns the system from a document generator into an accumulating asset.

3. **Reinforcement without enforcement decays.** A standard written in a markdown file that an agent is asked to "remember" will eventually be forgotten. Every mechanically checkable standard gets a script and a named gate in the numbered pipeline. Documents describe judgment; scripts enforce what does not require judgment.

4. **Every quality rule creates fabrication pressure — treat that as the rule's main risk.** "Every bullet needs a metric" invites inventing a number. "Fill the page" invites padding. "Close the gap" invites claiming a skill. For each standard, name the tempting shortcut explicitly and forbid it by name, because the failure mode is the agent quietly satisfying the letter of the rule.

5. **The candidate must be able to defend every line.** A polished document they cannot speak to in an interview is worse than a plainer one they can. Generated text is a suggested edit, never a finished product.

6. **Scripts surface, humans decide.** A linter flags a weak metric; it does not rewrite it. A gap checker flags a missing skill; it does not remove the claim or invent one. Keep the division of labor clean — this is what makes the automated parts trustworthy enough to run unattended.

---

## 2. Inventory — what is stock vs. what this blueprint adds

Do not rebuild what already ships. Stock v1.29.0 already provides:

- The A–G evaluation report format, `## Machine Summary` YAML block, Block G posting-legitimacy signals, compensation-reliability tiering, and the "recommend against applying below 4.0/5" rule (`modes/oferta.md`, `batch/batch-prompt.md`)
- Atomic report numbering (`reserve-report-num.mjs`), tracker merge flow (`batch/tracker-additions/*.tsv` → `merge-tracker.mjs`), canonical status writes (`set-status.mjs`)
- The fabricated-metric gate (`verify-cv-facts.mjs`), the JSON→HTML CV renderer (`build-cv-html.mjs`), PDF rendering (`generate-pdf.mjs`), cover-letter rendering (`generate-cover-letter.mjs`), template resolution (`cv-templates.mjs`)
- The zero-LLM JD skill classifier (`jd-skill-gap.mjs`) and the recruiter-side heuristics (`modes/heuristics/recruiter-side.md`)
- The user-layer/system-layer Data Contract and the `modes/_custom.md` extension point

This blueprint adds, on top of that:

| # | Addition | Type | Section |
|---|---|---|---|
| 1 | House rules governing gap verification, metric standards, page fill, confidentiality | `modes/_custom.md` (user layer) | §3 |
| 2 | `modes/heuristics/harvard-resume.md` — document language standards | New file | §4.1 |
| 3 | `modes/heuristics/metric-impact.md` — metric grading + rework protocol | New file | §4.2 |
| 4 | `resume-lint.mjs` — mechanical standards gate | New script | §5.1 |
| 5 | `check-page-fill.mjs` — one-page fill gate (both directions) | New script | §5.2 |
| 6 | `resume-skill-diff.mjs` + `modes/skill-import.md` — old-resume skill importer | New script + mode | §5.3 |
| 7 | `build-cv-docx.mjs` — native editable Word output | New script (optional) | §5.4 |
| 8 | Numbered gate insertions into `modes/pdf.md` | System-layer patch | §6.1 |
| 9 | Prose-default + Harvard structure in `modes/cover.md` | System-layer patch | §6.2 |
| 10 | Template metadata (`section_order`, `page_margin`), optional CV sections, prose achievements | System-layer patches | §7 |
| 11 | Evaluation-side conventions (hold-blocks, severity tiering, pause-on-new-finding) | `modes/_custom.md` | §8.1 |
| 12 | Capture-once data files (`skill-verification.tsv`, `interest-signals.tsv`) | User-layer data | §9 |
| 13 | `check-patches.mjs` — verifies customizations survived an update | New script | §5.5 |

> **Data Contract warning, read before patching anything.** Items 8–10 modify *system-layer* files, which `node update-system.mjs apply` will overwrite on the next upstream release. Items 1, 11, 12 live in the user layer and survive updates. Run `node check-patches.mjs` after every update so a system update never silently deletes the pipeline gates (§5.5, §3.10).

---

## 3. House rules — `modes/_custom.md`

This is the highest-leverage file in the whole setup: it is user-layer (never auto-updated), it is read alongside the system instructions every session, and its rules take precedence over defaults. Copy `modes/_custom.template.md` to `modes/_custom.md` if it does not exist, then add the following.

Each rule below follows the same shape: **the rule**, **Why** (the reasoning, so edge cases can be judged rather than pattern-matched), **How to apply** (when it fires). Keep that shape for any rule added later — the "why" is what lets a future session extend the rule correctly instead of following it literally into a bad outcome.

### 3.1 Gap classifications are hypotheses, not facts

> Any "gap" produced by `jd-skill-gap.mjs`, `upskill.mjs`, or manual JD analysis only means the skill is not documented in `cv.md` — the candidate may well have it. Before presenting anything as a gap, or writing it into a study list, or omitting it from a tailored document:
>
> 1. Check `data/skill-verification.tsv` first — already-verified skills are never re-asked.
> 2. For unverified candidate gaps, **ASK the candidate** which they actually have, and what experience they have doing those things. Ask in one batch, not one question at a time.
> 3. Branch on the answer:
>    - **Candidate has it** → capture their description and add it to `cv.md` (the Skills line, and where they describe concrete work, the relevant experience bullet) **in their own words**. This is the sanctioned conversation-statement path from the Source-of-Truth Boundary, not fabrication. It is not a gap.
>    - **Candidate does not have it** → it is now a *verified* gap. Only now may it appear in a report's gap list, a study list, or an honest interview-prep note.
> 4. Either way, append the outcome to `data/skill-verification.tsv` so future analyses skip the question.
>
> **Why:** an undocumented skill and an absent skill look identical to a keyword matcher, and treating the first as the second both understates the candidate and permanently loses a real fact. **How to apply:** fires during evaluation (Block B gap analysis), CV tailoring (`modes/pdf.md` Step 4), and study-list generation.

**This is the single rule that changes the system's character the most.** It converts each application from a one-way document render into a short interview that makes `cv.md` permanently better. Follow-up questions should ask for *real scope and metrics* ("how many engagements?", "what did that replace?"), never for a self-assessment ("would you say you're strong at this?").

### 3.2 Every bullet needs a metric — and the metric must be worth including

> Every achievement bullet on a generated CV carries a quantified metric (number, currency figure, percentage, count, or time saved), not a bare task description.
>
> 1. If the source bullet already has a metric, use it as-is.
> 2. If a bullet selected for this CV has none, **STOP and ask the candidate** rather than shipping it bare or inventing a number.
> 3. Write whatever they supply back into `cv.md`, not just this one tailored CV.
> 4. If they genuinely have no number (some qualitative achievements do not reduce to one), keep the bullet but tighten the language to be concrete about scope and scale; do not force a fabricated figure.
> 5. **Having a number is necessary, not sufficient.** Grade every metric-bearing bullet against `modes/heuristics/metric-impact.md` (Strong / Adequate / Weak, judged against the *target role's peer group*) and run the six-question rework protocol on the Weak ones before rendering. Show the grading table rather than silently editing.
> 6. **Vary the qualifier phrasing across a document.** Do not write every benchmark as "X+"; mix in "over X" and "more than X", and leave a bare number when the figure is exact.
> 7. **This rule creates fabrication pressure — treat that as its main risk.** A `no-metric` warning is never resolved by inventing a plausible-sounding number. The only valid responses are: ask the candidate, or leave the bullet unquantified.
>
> **Why:** a routine count reads as activity logging and dilutes the strong bullets around it; a document built entirely of "X+" reads as templated rather than written. **How to apply:** per-document, during CV tailoring; a resume drawing many bullets from `cv.md` needs deliberate variety even when each source bullet uses "+" individually.

### 3.3 The CV stays to one page — and fills it

> Default to a single-page CV landing at **85–100%** of the page. Both directions are failure modes: overflowing to a second page, and stopping three-quarters of the way down looking unfinished.
>
> Fixing sparseness always means **adding back real, relevant, metric-backed content** — a bullet cut earlier for space, a strengthened rework from the grading step, a genuinely relevant section. **Never** inflate font size, line-height, or margins to fake fullness. If there is genuinely nothing left worth adding, say so and ship the shorter page rather than pad it.
>
> Check with `node check-page-fill.mjs output/{file}.html --format={letter|a4} --summary` before spending a full PDF render. This is the canonical tool; do not hand-roll the measurement inline.

### 3.4 Document standards govern all application documents

> `modes/heuristics/harvard-resume.md` is a standing reference for every CV, cover letter, and form answer, alongside `recruiter-side.md`. Run `node resume-lint.mjs <built.html> --summary` before every PDF render: `error` findings block the render; `warn` findings get reviewed and either fixed or **explicitly accepted in the hand-off note**.
>
> **Why:** the failure modes the linter catches (passive voice, an unquantified bullet, a stray pronoun) are exactly the ones that read as fine on a skim. **How to apply:** never skip the gate because a document "looks fine."

### 3.5 Never name a client or confidential counterparty

> In any candidate-facing document, describe consulting or agency engagements by scale, industry, and outcome ("12 client engagements", "a regional healthcare provider"), never by client name, unless the candidate explicitly confirms that specific name is public and cleared for use.
>
> **How to apply:** CVs, cover letters, form answers, outreach, and interview prep alike — including when a client name appears in a source file.

### 3.6 AI drafts are suggested edits, not finished products

> Present drafts for revision; run the Defensibility Gate (ask which lines the candidate could not defend in an interview) before treating any document as done; never auto-submit.
>
> **How to apply:** applies even when every fact traces to `cv.md` — that file can hold stale figures.

### 3.7 Cover letters are a standard deliverable, not an afterthought

> The CV is the standard document (bullets, metrics, one page). The cover letter is the narrative one: why the candidate is interested in this role and how they will excel in it, **not** a restatement of the CV. Offer it every time a CV is generated for a role the candidate is proceeding with; do not wait to be asked.

### 3.8 Cover letter openings start with the candidate, not the company

> Never open a cover letter by restating facts about the company back to them (their product rankings, growth stage, recent news, "inflection point" framing). They already know their own company. Start directly with the candidate: who they are, what drives them, their core strength, and how that helps the employer. A company-specific hook from the research step may still appear, but only in service of explaining the candidate's own motivation or fit — never as a standalone statement of fact about the company.
>
> **How to apply:** the Opening paragraph specifically. Company research still gets used; it is woven into the "why this role draws me" framing rather than led with.

### 3.10 Verify customizations survived a system update

> `update-system.mjs apply` replaces system-layer files wholesale, and several gates live inside them. Immediately after any update, run `node check-patches.mjs --summary`, **and run the test suite**. Anything reported MISSING is recovered by diffing the file against your own committed version and merging the local edits back in — merge, never blindly revert, because the upstream change that overwrote the file may itself be worth keeping.
>
> **Why:** nothing errors when a numbered pipeline step is simply absent; the next CV just renders with no lint gate, no metric grading, and no page-fill check. **How to apply:** part of the update mode's completion, not an optional follow-up.

### 3.9 Punctuation constraint for generated documents

> In user-facing application documents (CV payloads, cover letters, form answers, outreach), avoid em dashes and en dashes; restructure with commas, periods, semicolons, or parentheses. Hyphens inside compound words are fine.
>
> **Why:** the PDF ATS-normalization step rewrites dashes and can produce awkward spacing or stray punctuation in the rendered output. *(Verify this against your own renderer; if your normalization step handles dashes cleanly, this rule can be dropped.)*

---

## 4. Heuristics documents

These hold the judgment that cannot be scripted. They live in `modes/heuristics/` beside the stock `recruiter-side.md`.

### 4.1 `modes/heuristics/harvard-resume.md`

Document-language standards for all candidate-facing output. Applies to CVs, cover letters, form answers, and outreach — **not** to internal evaluation reports. Mark each rule the linter can check as `[lint]` so the agent runs the gate instead of relying on memory.

Required contents:

- **Governing principle.** Generated text is a suggested edit, not a finished product; facts are always the candidate's; the candidate must be able to defend every line; never auto-submit.
- **Resume language — should be:** specific not general, active not passive `[lint]`, strengths-focused, clear and unembellished, fact-based/quantified `[lint]`, easy to scan.
- **Top mistakes to avoid:** failure to tailor; spelling/grammar errors; missing contact information `[lint]`; passive language instead of action verbs `[lint]`; poor organization or skimmability; not demonstrating results `[lint]`.
- **Don't:** first-person pronouns `[lint]`; non-standard abbreviations `[lint]`; narrative style; slang; photo (except markets where it is expected); age or gender; references unless requested; starting a line with a date `[lint]`; optimizing for only one of {human reader, ATS}.
- **Do:** tailor per position; convey impact; stay format-consistent; balance text with white space; **order section headings by importance for the specific role** (section order is a tailoring decision, not a fixed template property); reverse-chronological within a section; verify formatting survives PDF conversion.
- **Action-verb bank**, grouped by category (leadership, communication, research, technical, teaching, quantitative, creative, helping, organizational), with the instruction to prefer a verb matching what the candidate actually did over a stronger-sounding one that overstates it. List the weak openers to replace: "helped", "assisted", "responsible for", "worked on", "participated in", "involved in", "tasked with" `[lint]`. Tense: present for the current role, past for prior ones.
- **Cover-letter structure:** three paragraphs, one page, no resume restatement. Opening (why writing, which position, why this employer, why a fit). Middle (one or two concrete proofs of the opening's claim — the reader treats the letter as a writing sample). Closing (reiterate interest, contact details, thanks). Plus: address a named person where possible with a **colon** after the salutation; research the organization first; concise and factual; no flowery language; do not overuse "I"; **same font type and size as the resume** `[lint]`.
- **Defensibility Gate.** After generating, present the bullets carrying a metric, a named tool, or a scope claim, and ask the candidate to flag any they could not comfortably defend in an interview. Revise or remove whatever they flag. Do not skip this because a fact "came from `cv.md`."
- **Recruiter-Lens Review.** Inline and bounded, no subagents: *"Taking the role of a recruiter for {company}, review this document against this job description. Identify areas of strength and any gaps in skillset or experience."* Report both to the candidate. Gaps are information, never license to invent a claim that closes the gap.
- **Privacy and confidentiality.** Never name a client without cleared confirmation; never surface proprietary system names, internal codenames, or customer data.

### 4.2 `modes/heuristics/metric-impact.md`

How to grade the metrics in a generated document and rework the weak ones *with* the candidate rather than around them.

Required contents:

- **The governing rule:** *reworking a weak metric means finding the truth that was left out, never manufacturing one.*
  - **Permitted:** surfacing real omitted context (before-state, baseline, counterfactual, what it unlocked); reframing the same fact around consequence instead of activity; asking the candidate for a real figure not yet provided; cutting the bullet entirely when nothing notable is behind it.
  - **Forbidden without exception:** raising or rounding a number; adding an unsupported superlative; implying broader ownership or scope than actually held; inventing a baseline so a percentage can be computed; keeping a figure the candidate cannot source.
  - A weak metric is resolved **by a conversation or by deletion — never by editing the digits.**
- **Grading tests**, judged relative to the target role's peer group (read the JD's seniority and scope first, then grade):

  | Test | Question |
  |---|---|
  | Scale | Is the magnitude notable for this role's peer group? |
  | Delta | Does it show a change the candidate caused, ideally before → after? |
  | Consequence | Does it land on money, time, risk, reliability, or users? |
  | Differentiation | Would most candidates for this role claim the same thing? |
  | Ownership | Is it clear the candidate drove it rather than sat nearby? |

- **Verdicts:** **Strong** (passes Delta or Scale, plus Consequence — ship it). **Adequate** (real scale but static, or a delta with no consequence named — ship if space is tight, sharpen if the candidate has the missing half). **Weak** (small static count, activity rather than outcome, or indistinguishable from any peer — rework or cut). Note the distinction that catches most weak bullets: *count of things produced is activity; what changed because they existed is impact.*
- **The six-question rework protocol.** Never ask "can you make this more impressive?" — that invites inflation and puts the work on the candidate. Ask instead:
  1. **Before-state** — "What was it like before you did this?" (turns a static count into a delta)
  2. **Counterfactual** — "What would have happened if nobody had?" (surfaces avoided cost, risk, headcount)
  3. **Relative scale** — "Is that a lot where you work? What's typical?" (a number only reads as impressive with a reference point the candidate has and the document does not)
  4. **Downstream** — "What did that unlock for other people?" (converts technical output into business consequence)
  5. **Difficulty** — "What made this hard? Who else could have done it?" (finds differentiation for work that sounds routine)
  6. **Recognition** — "Did anyone notice? Was it adopted, extended, cited?" (adoption is evidence of value when no metric exists)

  Then present a concrete rewrite for approval, showing what changed and which answer it came from. **If none of the six produce anything real, say so plainly and recommend cutting the bullet** — that recommendation is a legitimate outcome of the process, not a failure of it.
- **Reporting format.** Present grading as a table before the render, weakest first: `| Bullet (abbrev.) | Metric | Verdict | Why | What would strengthen it |`. Include the **Strong** rows too, so the candidate can see the whole document was checked rather than just the problems. Grade only the bullets going on *this* CV, not all of `cv.md`.
- **Write-back.** Any bullet whose rework produces a new fact must have that fact written back to `cv.md`, so the stronger version is reused rather than re-derived next time.
- **Qualifier variety.** A resume built entirely from "X+" reads as templated even when every figure is real. Mix `X+`, `over X`, `more than X`, and a bare number when the figure is exact.

---

## 5. Enforcement scripts

All four follow the same conventions: zero-LLM, deterministic, `--summary` for human-readable output and bare invocation for JSON, `--self-test` that exits non-zero on failure, and registration in `test-all.mjs`. **None of them ever writes to `cv.md` or any document** — they report, the agent and candidate decide.

### 5.1 `resume-lint.mjs` — mechanical standards gate

Reads **rendered HTML** (not `cv.md`), so it catches problems introduced during tailoring rather than only problems already in the source.

**CLI:**
```bash
node resume-lint.mjs <built.html> [--summary] [--cover <cover.html>] [--kind=cover]
node resume-lint.mjs --self-test
```
Exit 1 if any `error` finding; exit 0 otherwise (warnings do not block, a human adjudicates).

**Checks:**

| Rule | Severity | Scope | Fires on |
|---|---|---|---|
| `pronoun` | error | resume only | First-person pronouns (`I`, `my`, `me`, `mine`, contractions) in bullet text |
| `contact` | error / warn | resume only | No email found (error); no phone found (warn) |
| `font-pair` | error / warn | pair check | CV and cover letter declare different body `font-family` (error) or `font-size` (warn) |
| `passive` | warn | both | Auxiliary + past participle; **exclude** "without being/getting X" (a proactivity idiom, not agent-obscuring passive voice) |
| `weak-verb` | warn | both | Bullet contains a weak opener from the list in §4.1 |
| `no-metric` | warn | resume only | Bullet contains no digit at all |
| `weak-metric` | warn | resume only | Bullet has numbers, but none convey scale or change (see below) |
| `date-first` | warn | both | Bullet opens with a date |
| `abbreviation` | warn | both | ALLCAPS token not on the allowlist, first occurrence only |
| `qualifier-repetition` | warn | resume only | "X+" appears **4 or more times** across bullets with no variation |

**`weak-metric` heuristic** — a number earns its place by conveying notable *scale* or a *change the candidate caused*. Treat as substantive if the bullet matches either:
- **Large magnitude:** a currency amount; a magnitude suffix (`10K`, `1.2M`, `3B`); a byte scale (`1TB`, `500GB`); any bare integer ≥ 100; a percentage ≥ 20.
- **Delta language:** cut / reduce / decrease / increase / improve / save / avoid / eliminate / accelerate / grow / scale / boost / double / triple / halve / shorten / shrink / raise / lower / **replace** / "from X to Y".

Otherwise flag it. `weak-metric` must never double-report a bullet already flagged `no-metric`, and both are skipped for cover letters (a letter is prose, not a bullet inventory).

**Scoping rules that matter** (each exists because of a real false positive):
- Bullet-level checks read `<li>` text only; the contact/header block is excluded, so a name or a "City, ST" line is never linted as prose.
- The `qualifier-repetition` count reads bullets only, so an email using plus-addressing (`name+jobs@example.com`) can never contribute a match.
- The abbreviation allowlist must cover: common tech/industry acronyms, **all US state postal codes** (a "City, ST" line is standard and never spelled out), degree and title abbreviations, unit abbreviations, and standard English all-caps words. See §11 for the per-candidate extension.

### 5.2 `check-page-fill.mjs` — one-page fill gate

`generate-pdf.mjs`'s page count catches overflow only. This catches **both** failure directions.

**CLI:**
```bash
node check-page-fill.mjs <built.html> [--format=letter|a4] [--summary]
node check-page-fill.mjs --self-test
```
Exit 1 on `overflow` or `sparse`; exit 0 on `ok`.

**Method:**
1. Resolve the printable content box in px at 96dpi: page size (letter 8.5×11in, A4 210×297mm) minus margins.
2. **Resolve margins by importing `resolvePageMargin` from `generate-pdf.mjs`** (see §7.2) so the measurement uses the exact margins the PDF will render with, rather than an independently guessed value. Parse the CSS margin shorthand with standard 1–4 value expansion.
3. Render the HTML in Playwright at the content-box width, `await document.fonts.ready`, and read `scrollHeight` of `.page` (falling back to `body`).
4. Classify the ratio of rendered height to available height: `> 1.0` → **overflow**; `< 0.85` → **sparse**; otherwise **ok**.

The script only measures. What to add back when sparse is a judgment call made under §3.3 — and it is always *more real content*, never inflated typography.

### 5.3 `resume-skill-diff.mjs` + `modes/skill-import.md` — old-resume skill importer

Recovers skills that only ever made it into a previous resume and never into `cv.md`. A one-time (or occasional) complement to the per-application gap loop in §3.1.

**CLI:** `node resume-skill-diff.mjs <old-resume.md|.txt> [--summary]` / `--self-test`. Plain text and markdown only; for a PDF or Word file, have the agent read it and save the extracted text first.

**Classification against `cv.md`:** `alreadyNamed` (in the Skills section) / `alreadyInProse` (appears elsewhere in `cv.md`) / **`candidate`** (absent from `cv.md` entirely — the list that matters).

**Deliberate asymmetry with `jd-skill-gap.mjs`:** the JD checker scans only the requirements block, because over-reporting there misreports a gap as real. This one scans the *entire* old resume, because over-extraction is harmless — every candidate token is reviewed by the candidate before anything is written.

**Mode flow (`modes/skill-import.md`):** get the old document as text → run the diff → **filter obvious noise** (company names, project names, city names) before showing the candidate, do not make them wade through it → present the filtered list and confirm in one batch → for each confirmed skill also ask where/how it was used, but **do not block adding the skill on getting the description** (a "description pending" note is acceptable and can be resolved later) → write confirmed skills into the most fitting existing `cv.md` Skills category (never create a new category for one skill without asking) → log each to `data/skill-verification.tsv` with `source_job` set to `resume-import:{basename}` → drop declined or uncertain skills with no record, since silence beats a manufactured entry.

### 5.4 `build-cv-docx.mjs` — native editable Word output *(optional)*

Produces a real `.docx` from **the same JSON payload** the HTML/PDF pipeline uses — already fact-gated and lint-gated, so nothing needs re-verifying.

Construct the document directly with the `docx` library's paragraph/style primitives. **Do not convert the rendered HTML:** HTML-to-docx converters reliably mangle CSS (flex layouts, floats, pseudo-elements). Requires adding `docx` to `package.json` dependencies.

`node build-cv-docx.mjs <payload.json> <output.docx>`. Because styles are hardcoded per layout, a docx renderer matches exactly one template; if the candidate's configured template differs, still generate it but say so in the hand-off report.

### 5.5 `check-patches.mjs` — update survival check

Holds a manifest of `{file, sentinel, what}` entries, one per customization, where the sentinel is a string that exists only because of that customization (a filename or an exported identifier — specific enough that upstream will not coincidentally introduce it, stable enough that a reword will not break it). Plus a list of wholly-local files that should simply exist.

`node check-patches.mjs [--summary]` reports each missing patch with the reason (`file not found` vs `sentinel absent — patch was overwritten`); exit 1 if any are missing. `--self-test` covers the all-present, overwritten-file, and deleted-file cases.

It deliberately does **not** re-apply anything. Git holds the content; recovery is a merge that needs judgment. This script only answers "is anything missing", which is the part that is easy to not notice.

---

## 6. Mode-file patches (system layer)

### 6.1 `modes/pdf.md` — the gate sequence

Insert these steps into the existing numbered pipeline. The **order matters**: cheap deterministic gates run before expensive renders, and all judgment gates run before the candidate is asked to approve anything.

**Step 8b — language standards (before writing any line):**
> Read `modes/heuristics/harvard-resume.md` and apply it to every line you write: action-verb openers, no first-person pronouns, no non-standard abbreviations, quantified results, present tense for the current role and past for prior ones. Order sections by importance **for this role** rather than assuming the template's default order — section order is a tailoring decision. Never name a client without explicit confirmation that the name is cleared.

**Step 18b — standards gate (after the fact gate, before rendering):**
> Run `node resume-lint.mjs output/{file}.html --summary`. `error` findings must be fixed before rendering. `warn` findings are heuristic — review each and fix or **consciously accept**; do not ignore them silently. If a cover letter exists for this application, add `--cover output/{cover}.html` to catch a font mismatch between the pair. `qualifier-repetition` means the document overuses "X+" — vary the phrasing.

**Step 18c — metric impact grading:**
> Read `modes/heuristics/metric-impact.md` and grade every metric-bearing bullet on this CV against the target role's peer group (Strong / Adequate / Weak). Present the grading table to the candidate, weakest first, **including the Strong rows** so they can see the whole document was checked. For each Weak bullet, run the six-question rework protocol with them, propose a concrete rewrite, and get approval. Write any new fact the rework produces back to `cv.md`.

**Step 18d — page-fill gate:**
> Run `node check-page-fill.mjs output/{file}.html --format={letter|a4} --summary`. `sparse` means add back real, relevant, metric-backed content — never inflate font size, line-height, or margins. If there is no genuinely relevant content left and the page is still sparse, say so plainly rather than padding. **Never resolve a weak metric by changing the number** — reworking means recovering a real omitted fact, or cutting the bullet; recommending a cut is a legitimate outcome.

**Step 19b — Recruiter-Lens Review** (after the PDF renders): inline and bounded, no subagents. Review the finished document as a recruiter for this company against this JD; report strengths and gaps. Gaps are information, never license to invent a claim.

**Step 19c — Defensibility Gate:** list the bullets carrying a metric, a named tool, or a scope claim, and ask the candidate to flag any they could not comfortably defend in an interview. Revise or remove whatever they flag. **Run this even when every fact came from `cv.md`.**

**Step 20 — editable copy, always** *(if §5.4 is installed)*: generate the `.docx` from the same payload as a standard part of every CV; no need to ask first.

**Step 21 — report:** PDF path, docx path, page count, keyword coverage, any skill gaps from Step 4 still unaddressed, **and any accepted `resume-lint` warnings**.

### 6.2 `modes/cover.md` — prose default and paired gates

- **Achievement selection — prose is the default.** A cover letter is three paragraphs and must not reiterate the resume; the reader treats it as a writing sample. So decide first whether the letter needs a bullet block at all. **Default: prose** — fold one or two concrete proofs into the middle paragraph. **Bullets only when they genuinely read better** (e.g. a highly technical role where quantified proofs land harder as a short list), capped at **3**, never a resume restatement.
- **Grade the proofs.** A letter carries far fewer proofs than a CV, so every one must be **Strong** under `metric-impact.md`. If a chosen proof grades Weak, run the rework protocol or select a different achievement — never inflate the figure to make it fit.
- **Language rule 0:** read `modes/heuristics/harvard-resume.md` first; its cover-letter section governs structure, salutation punctuation (colon, not comma), and the confidentiality rule.
- **Font-pair rule:** the cover-letter template must match the CV template; if the two resolve to different families, stop and fix the pairing rather than shipping a mismatched set. `node resume-lint.mjs <cv.html> --cover <cover.html>` reports this mechanically.
- **Payload:** support `achievements_prose` (a plain string rendering as one `<p>`) alongside the existing `achievements` array. Set one or the other, never both.
- **After rendering:** run the paired lint gate, then the **Recruiter-Lens Review** and **Defensibility Gate**, and note any consciously accepted warnings in the hand-off.

---

## 7. Renderer patches (system layer)

### 7.1 `build-cv-html.mjs` — optional sections

- Add a **Leadership & Service** section that reuses the experience shape (org / role / dates / bullets), with `SECTION_LEADERSHIP` / `LEADERSHIP` placeholders. Templates that omit the placeholders simply never see the values.
- Generalize optional-section removal into a `dropSection(html, marker)` helper that prefers an explicit `<!-- X -->…<!-- /X -->` pair and falls back to "from the marker to the next HTML comment."
  **Why this matters:** the original implementation deleted the Projects block by matching up to a *specific* following marker. Section order differs per template — a format that leads with Education leaves a bare header behind under that assumption. Never key section removal off which marker comes next.
- Report `leadershipEntries` in the output counts.

### 7.2 `generate-pdf.mjs` — template metadata

Templates declare their own layout facts in a `<!-- career-ops-template ... -->` comment that survives into the built HTML:

```html
<!-- career-ops-template
name: {Template Name}
page_margin: 0.6in 0.6in 0.5in 0.6in
section_order: fixed
-->
```

- **`resolvePageMargin(html)`** — read and validate an optional margin override, falling back to the shared default. Validate strictly against a CSS margin shorthand pattern (1–4 lengths, each a number plus an absolute unit) and warn-and-ignore anything else: **this value is interpolated straight into a `<style>` block**, so `calc()`, `var()`, `;`, and `}` must all be rejected. Export it so `check-page-fill.mjs` measures against the same margins.
- **`templateFixesSectionOrder(html)`** — when a template declares `section_order: fixed`, skip the section-order validation guard. Some templates reproduce a published format whose order is part of the format itself; for those, divergence from `cv.md`'s heading order is the intended outcome rather than a symptom. Declaring it on the template beats passing an `--allow-reorder` flag on every render, which trains the operator to wave through a real safety check.

### 7.3 `generate-cover-letter.mjs` — prose achievements

Render the achievements slot as **either** a prose paragraph **or** a bullet list, never both: `achievements_prose` (string) takes precedence when set, `achievements` (the `{lead, impact}[]` array) is the fallback so every previously built payload renders unchanged.

### 7.4 `jd-skill-gap.mjs`

Export the skills-section splitter alongside the existing exports so other consumers (the old-resume differ) can reuse the same parsing rather than reimplementing it.

### 7.5 `test-all.mjs`

Register all four new scripts' `--self-test` entries, plus a live Playwright render asserting that a near-empty page classifies as `sparse`, and a cover-letter test asserting the prose/bullet branch.

---

## 8. The end-to-end workflows

### 8.1 Evaluating a posting

Stock `modes/oferta.md` / `auto-pipeline` handles the mechanics (reserve report number → verify liveness in a real browser → Blocks A–G → Machine Summary → tracker TSV → `merge-tracker.mjs` → release the number). Layer these conventions on top — add them to `modes/_custom.md` so they survive both updates and fresh sessions:

- **Verify gaps before reporting them.** Block B's gap list runs through §3.1 first. A "gap" that turns out to be an undocumented skill becomes a `cv.md` edit in the same turn, and the evaluation continues with the corrected picture. This is the step that makes every later application stronger.
- **Hold the tailoring blocks when the score is below threshold.** For scores under 4.0, write Blocks E (Customization Plan) and F (Interview Plan) as `*(Held pending candidate confirmation — see closing note.)*` and end the report with a closing note stating the score, the strongest counterargument, and an explicit ask. Generate no documents until the candidate says to proceed. Above 4.0, tailoring proceeds as part of standard processing.
- **Pause even on an explicit upfront request when research surfaces a serious *new* negative finding.** If the candidate said "evaluate this and generate everything" but research then turns up something they could not have known when they asked — confirmed layoffs, a severe financial signal, a specific and corroborated culture pattern — stop and surface it before generating documents. The informational asymmetry did not exist when they phrased the request, so honoring the original phrasing is not actually honoring the intent.
- **Tier the severity of negative signals; do not treat them as equivalent.** Rank in ascending order: (1) ordinary mixed reviews and generic complaints; (2) *specific and repeated* complaints naming a pattern; (3) hard verified facts — announced layoffs, disclosed restructuring costs, filed financials, a company's own posted disclaimer. Corroboration across *independent* source types (financial filings **and** employee reports agreeing) is a stronger signal than either alone, and should be named as such in the report.
- **Distinguish an unresolvable gap from an unverified one.** After §3.1 runs, whatever remains is a real gap and goes in the report honestly — never papered over, never closed with an invented claim, and never silently dropped from the candidate's view.
- **Record the closing recommendation in the tracker note**, so a later session reading only the tracker gets the same picture as one reading the report.

### 8.2 Generating a tailored CV

```
JD → skill-gap check → GAP VERIFICATION CONVERSATION (§3.1) → cv.md write-back
  → keyword extraction → risk map → tailored payload (JSON)
  → build-cv-html.mjs
  → verify-cv-facts.mjs        [hard gate: fabricated metrics]
  → resume-lint.mjs            [errors block; warnings adjudicated]
  → metric impact grading      [table to candidate; rework Weak bullets; write-back]
  → check-page-fill.mjs        [85–100%; fix by adding real content only]
  → generate-pdf.mjs
  → Recruiter-Lens Review + Defensibility Gate
  → build-cv-docx.mjs
  → hand-off report incl. accepted warnings
```

Iterate the trim/extend loop against `check-page-fill.mjs` before rendering the PDF. When trimming to fit, **cut whole bullets by relevance rather than shaving words** — the fill metric moves in line-height increments, so removing a few words from a wrapped line usually changes nothing.

**Never strip a qualifier to make a bullet fit** if doing so changes its meaning. Shortening "1.2M healthcare financial transactions" to "1.2M financial transactions" in an application to a financial-services employer is not a space saving; it is a misleading implication. Precision outranks fit.

### 8.3 Generating a cover letter

Full interactive flow, never skipped or shortcut: company research → keyword confirmation → gap handling → the four framing prompts (why this role / what problems to solve / approach / tone) → **draft in chat and wait for explicit approval** → render PDF → paired lint gate → Recruiter-Lens and Defensibility gates. Apply §3.7 (offer it every time) and §3.8 (open with the candidate, not the company).

---

## 9. Data conventions

| File | Shape | Rule |
|---|---|---|
| `data/skill-verification.tsv` | `date  skill  verdict[has\|gap]  evidence/notes  source_job` | **Append-only.** Written on every §3.1 verification. Checked *before* asking, so a question is never repeated. A row may carry "has, description pending" — resolve it opportunistically when a later JD makes that skill relevant again. |
| `data/interest-signals.tsv` | `date  company  title  seniority  industry  stack_keywords  comp  location  source_url` | **Append-only.** One row per role the candidate expresses interest in. When a signal recurs 3+ times and is not yet reflected in targeting, update `modes/_profile.md` / `config/profile.yml` / `portals.yml` — additive changes applied directly with a dated comment, removals or contradictions proposed first. **Hard rule: interest ≠ experience.** This never writes skills or accomplishment claims into `cv.md`. |
| `jds/{company}-{role}.md` | Saved JD text | Required because the gap checker reads a file. Save before running it. |
| `batch/tracker-additions/*.tsv` | 9 tab-separated columns | The only path for adding tracker rows; merge with `merge-tracker.mjs`. Status updates go through `set-status.mjs`. Never hand-edit the tracker table. |

**The capture-once loop is the point.** Three separate gates (skill verification, metric rework, old-resume import) all end with the same instruction: *write the new fact back to `cv.md`*. Without that write-back each application re-asks the same questions and the system never compounds.

---

## 10. Optional extras

These are format or convenience choices, not part of the core workflow. Skip them freely.

- **A custom template pair.** If reproducing a specific published resume format, decode the source document's own measurements (margins, point sizes, fonts, tab stops, indents) and record them in a header comment in the template, so later edits adjust against the spec rather than against guesswork. Declare `page_margin` and `section_order: fixed` in the template metadata (§7.2). Keep the CV and cover-letter templates as a **matched pair** — the font-pair lint check enforces this.
- **A local dashboard.** A zero-dependency Node HTTP server on a fixed localhost port, serving a read-only view over the tracker, pipeline, and reports, plus a one-click launcher script. Useful; entirely optional. Keep exactly **one** copy of it (see §12, gap 2).

---

## 11. What to personalize in a new setup

Everything above is candidate-agnostic. These are the seams where person-specific values plug in — all in the user layer:

| What | Where | Note |
|---|---|---|
| Target archetypes, narrative, superpowers, comp targets, location policy and its scoring tiers, industry preferences | `modes/_profile.md`, `config/profile.yml` | Never in system-layer files |
| Experience, skills, metrics, certifications | `cv.md` | The only source of factual claims |
| Template choice and CV/cover pairing | `config/profile.yml` (`cv.template`, `cover_letter.template`) | Must match each other |
| **Lint abbreviation allowlist additions** | Should be user-layer config — see §12, gap 3 | e.g. an alma mater's initials, an industry acronym specific to the candidate's field |
| Paper format | `letter` (US/Canada) vs `a4` | Passed identically to the payload, the page-fill check, and the PDF renderer |
| Spend tier / model routing | `config/profile.yml`, `modes/_custom.md` | Keep judgment-heavy scoring off the cheapest model |

Scrub before reuse: any real phone number, email, employer, client, or school baked into script constants or self-test fixtures.

---

## 12. Known gaps and planned improvements

Honest list of what is still weak, roughly by value. Resolved items are kept with their fix, because the failure mode is worth understanding when rebuilding.

**Still open:**

1. **The fact gate cannot catch a *newly invented* number.** `verify-cv-facts.mjs` validates metrics that exist in source files; a plausible-sounding figure invented during tailoring passes clean. *Fix:* extract every numeric token from the built HTML and flag any appearing in no source file. This is the highest-value remaining safety improvement, because §3.2 actively creates pressure to invent numbers.
2. **Synonym blindness in the skill matcher.** A JD asking for "ETL" reports a gap when `cv.md` says "ELT", and vice versa. Needs a small synonym/alias map. Low harm (the §3.1 conversation catches it) but it adds noise to every run.
3. **Only one template has a docx renderer.** Others fall back silently to that layout.
4. **User-layer files are still unbacked.** `modes/_custom.md`, `cv.md`, `config/profile.yml` and `data/` are gitignored by the stock `.gitignore`. In a **private** repo they can safely be un-ignored; in a public one they must not be. Decide deliberately — the house rules file is the single most expensive thing to recreate.

**Resolved (kept for the reasoning):**

5. ~~System-layer patches unprotected against updates.~~ → `check-patches.mjs` verifies every customization by sentinel string and reports what an update removed. Run it after every `update-system.mjs apply` (§3.10). It deliberately does **not** auto-restore: recovery is a merge that needs judgment, because the upstream change that overwrote the file may itself be worth keeping.
   **This failure is not hypothetical — it has already happened twice in practice.** An update replaced `templates/cv-template.html` and shipped tests referencing new exports, but skipped `build-cv-html.mjs` and `generate-pdf.mjs` because both carried local modifications. Result: the base template gained placeholders its renderer cannot resolve, and two test files import an export that does not exist. Both went unnoticed for weeks because the active template path did not touch either. **Run the test suite after every update, not just the patch check.**
6. ~~Duplicate dashboard copies.~~ → keep exactly one.
7. ~~Candidate-specific values in system-layer scripts.~~ → the linter merges an optional user-layer `config/lint-allowlist.json` (array, or `{"abbreviations": [...]}`) into its allowlist; a malformed file warns rather than blocking a render. Keep personal initialisms there, never inline.
8. ~~PDF manifest last-write-wins per report number.~~ → rows are keyed by (report number, kind), with `kind` appended as a **sixth** column so existing readers that length-check fields 0–4 ignore it. Within a report, cover rows are written before CV rows, because the dashboard resolves a report number with "later rows win" and a report number should resolve to the CV.
9. ~~Cross-section abbreviation state.~~ → an abbreviation the document defines on first use ("Fast Healthcare Interoperability Resources (FHIR)") is no longer flagged, and the expansion is matched across the whole document so a definition in the summary covers a bare use in a later bullet.
10. ~~JD extractor noise.~~ → the stopword list now covers requirement-bullet qualifiers ("Hands-on", "Direct experience", "Comfort collaborating") that were being captured as skill tokens and reported as false gaps.

---

## 13. Setup checklist

On a fresh clone, in order:

- [ ] Complete stock onboarding (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`); confirm with `node doctor.mjs --json`.
- [ ] Copy `modes/_custom.template.md` → `modes/_custom.md`; add the house rules from §3.
- [ ] Create `modes/heuristics/harvard-resume.md` (§4.1) and `modes/heuristics/metric-impact.md` (§4.2).
- [ ] Create `resume-lint.mjs` (§5.1) and `check-page-fill.mjs` (§5.2), each with a `--self-test`.
- [ ] Patch `modes/pdf.md` with Steps 8b, 18b, 18c, 18d, 19b, 19c, and the report step (§6.1).
- [ ] Patch `modes/cover.md` with the prose default, grading requirement, font-pair rule, and closing gates (§6.2).
- [ ] Patch `generate-pdf.mjs` with `resolvePageMargin` + `templateFixesSectionOrder` (§7.2); patch `generate-cover-letter.mjs` for prose achievements (§7.3).
- [ ] Register the new self-tests in `test-all.mjs`; run the full suite.
- [ ] Create `data/skill-verification.tsv` with its header row (§9).
- [ ] Optional: old-resume importer (§5.3), docx renderer (§5.4), custom template pair, dashboard (§10).
- [ ] Create `check-patches.mjs` (§5.5) and add the post-update rule (§3.10).
- [ ] Smoke-test end to end on one real posting: verify the gap conversation fires, the grading table appears, both gates run, and the fill lands in range.

---

*This document describes process only. Every factual claim in any generated document comes from the candidate's own user-layer files or from statements they make directly in conversation — never from this blueprint, and never from inference.*
