# Harvard MCS Resume & Cover Letter Heuristics

Source: Harvard FAS Mignone Center for Career Success, "Create Impactful Resumes
and Cover Letters," plus its companion "AI for Resumes and Cover Letters" guidance.

Applies to candidate-facing documents: CV/resume PDFs, cover letters, form
answers, recruiter outreach. Does **not** apply to internal evaluation reports.

Companion file: `recruiter-side.md` (risk map, six-second gate, business-value
bullets). Where the two overlap they agree; this file adds the language rules,
the failure list, and the AI-specific process guardrails.

Mechanical enforcement lives in `resume-lint.mjs`. Rules here that the linter
can check are marked **[lint]** — do not rely on memory for those, run the gate.

---

## The governing principle

> "Generative AI should not be the primary author — not least because its output
> will likely be very generic."

This is the constraint the rest of the file serves. career-ops generates
documents, so the honest reading is:

- **Facts are always the candidate's.** Every claim traces to `cv.md`,
  `article-digest.md`, `config/profile.yml`, or a statement the candidate made
  in conversation. This is already the Source-of-Truth Boundary in `AGENTS.md`.
- **Generated wording is a suggested edit, not a finished product.** Present
  drafts for revision. Never treat a first render as done.
- **The candidate must be able to defend every line.** See the Defensibility
  Gate below. A bullet the candidate cannot speak to in an interview is a
  liability no matter how well it reads.
- **Never auto-submit.** Already an `AGENTS.md` rule; restated because the
  Harvard guidance makes it a professional-integrity point, not just a safety one.

---

## Resume language

**Should be:**

- Specific rather than general
- Active rather than passive **[lint]**
- Focused on communicating strengths
- Clear and direct, not embellished
- Fact-based (quantify and qualify wherever possible) **[lint]**
- Easy to scan quickly

**Top resume mistakes to avoid:**

1. Failing to tailor the resume to the position or industry
2. Spelling and grammar errors
3. Missing contact information **[lint]**
4. Using passive language instead of action verbs **[lint]**
5. Lacking organization, conciseness, or skimmability
6. Not demonstrating results **[lint]**

**Don't:**

- Use personal pronouns ("I", "my", "me") **[lint]**
- Abbreviate unless the abbreviation is industry-standard **[lint]**
- Use a narrative style
- Use slang or colloquialisms
- Include a photo *(the `candidate.photo` slot stays empty for US/UK/ATS-first
  markets; it exists only for DACH/continental-Europe applications)*
- Include age or gender
- List references unless specifically requested
- Start a line with a date **[lint]**
- Ignore either audience: the resume must satisfy human readers **and** ATS

**Do:**

- Tailor content to each position applied for
- Convey impact and achievements
- Stay consistent in format and content
- Balance text with white space so the page is easy to follow
- Use consistent spacing, italics, bold, and capitalization for emphasis
- **Order section headings by importance for the specific role.** Section order
  is a tailoring decision, not a fixed template property.
- List entries within a section in reverse chronological order
- Verify formatting survives conversion to PDF
- Know the material inside and out

---

## Action verbs

Open every bullet with one. Categories below are the Harvard bank; prefer a verb
that matches what the candidate actually did over a stronger-sounding one that
overstates it.

- **Leadership:** Accomplished, Achieved, Administered, Analyzed, Assigned, Attained, Chaired, Consolidated, Contracted, Coordinated, Delegated, Developed, Directed, Earned, Evaluated, Executed, Handled, Headed, Impacted, Improved, Increased, Led, Mastered, Orchestrated, Organized, Oversaw, Planned, Predicted, Prioritized, Produced, Proved, Recommended, Regulated, Reorganized, Reviewed, Scheduled, Spearheaded, Strengthened, Supervised, Surpassed
- **Communication:** Addressed, Arbitrated, Arranged, Authored, Collaborated, Convinced, Corresponded, Delivered, Developed, Directed, Documented, Drafted, Edited, Energized, Enlisted, Formulated, Influenced, Interpreted, Lectured, Liaised, Mediated, Moderated, Negotiated, Persuaded, Presented, Promoted, Publicized, Reconciled, Recruited, Reported, Rewrote, Spoke, Suggested, Synthesized, Translated, Verbalized, Wrote
- **Research:** Clarified, Collected, Concluded, Conducted, Constructed, Critiqued, Derived, Determined, Diagnosed, Discovered, Evaluated, Examined, Extracted, Formed, Identified, Inspected, Interpreted, Interviewed, Investigated, Modeled, Organized, Resolved, Reviewed, Summarized, Surveyed, Systematized, Tested
- **Technical:** Assembled, Built, Calculated, Computed, Designed, Devised, Engineered, Fabricated, Installed, Maintained, Operated, Optimized, Overhauled, Programmed, Remodeled, Repaired, Solved, Standardized, Streamlined, Upgraded
- **Teaching:** Adapted, Advised, Clarified, Coached, Communicated, Coordinated, Demystified, Developed, Enabled, Encouraged, Evaluated, Explained, Facilitated, Guided, Informed, Instructed, Persuaded, Set Goals, Stimulated, Studied, Taught, Trained
- **Quantitative:** Administered, Allocated, Analyzed, Appraised, Audited, Balanced, Budgeted, Calculated, Computed, Developed, Forecasted, Managed, Marketed, Maximized, Minimized, Planned, Projected, Researched
- **Creative:** Acted, Composed, Conceived, Conceptualized, Created, Customized, Designed, Developed, Directed, Established, Fashioned, Founded, Illustrated, Initiated, Instituted, Integrated, Introduced, Invented, Originated, Performed, Planned, Published, Redesigned, Revised, Revitalized, Shaped, Visualized
- **Helping:** Assessed, Assisted, Clarified, Coached, Counseled, Demonstrated, Diagnosed, Educated, Enhanced, Expedited, Facilitated, Familiarized, Guided, Motivated, Participated, Proposed, Provided, Referred, Rehabilitated, Represented, Served, Supported
- **Organizational:** Approved, Accelerated, Added, Arranged, Broadened, Cataloged, Centralized, Changed, Classified, Collected, Compiled, Completed, Controlled, Defined, Dispatched, Executed, Expanded, Gained, Gathered, Generated, Implemented, Inspected, Launched, Monitored, Operated, Organized, Prepared, Processed, Purchased, Recorded, Reduced, Reinforced, Retrieved, Screened, Selected, Simplified, Sold, Specified, Steered, Structured, Systematized, Tabulated, Unified, Updated, Utilized, Validated, Verified

Weak openers to replace when stronger ownership is truthful: "helped",
"assisted", "responsible for", "worked on", "participated in", "involved in",
"tasked with". **[lint]**

Tense: present for the current role, past for everything prior.

---

## Cover letters

Harvard's structure — three paragraphs, one page, no resume restatement:

1. **Opening.** State why you are writing, name the position, say how you heard
   about it if relevant, and say why this employer and what makes you a fit for
   their stated needs. Specific but brief.
2. **Middle.** Connect your story to this position with one or two concrete
   examples that prove the fit claimed in the opening. **Do not reiterate the
   entire resume.** The reader treats the letter as a writing sample.
3. **Closing.** Reiterate interest, give phone and email, thank them for their
   consideration.

**General rules:**

- Address a specific person by name where possible, and use a colon after the
  salutation, not a comma
- Research the organization before writing
- Concise and factual, no more than a single page, no flowery language
- Give examples that support your skills and qualifications
- Write from the reader's perspective: what convinces them you can do the job?
- Convey briefly why you are motivated by this specific role and company
- Do not overuse "I" — the resume bans first person outright, the letter simply
  should not lean on it
- Treat it as a marketing document: use plenty of action verbs
- Reference skills and experience from the job description and connect them to
  real credentials
- Confirm formatting survives PDF conversion
- **Same font type and size as the resume** — the two are one set **[lint]**

---

## Defensibility Gate (run before delivering any CV or cover letter)

Harvard: *"Know your documents. Be able to speak to every line of your resume if
asked in an interview. Read it aloud to catch repetitions or inaccuracies."*

Convert that into an actual step rather than an aspiration. After generating,
present the bullets that carry a metric, a named tool, or a scope claim and ask
the candidate to flag any they could not comfortably defend in an interview.
Revise or remove whatever they flag. Do not skip this because a fact "came from
`cv.md`" — the candidate's own file can hold stale figures.

---

## Recruiter-Lens Review (run before delivering any CV or cover letter)

The Harvard AI guidance recommends role-play review prompts. Run this one
inline, against the JD, before showing the final document:

> Taking the role of a recruiter for {company}, review this document against
> this job description. Identify areas of strength and any gaps in skillset or
> experience.

Report strengths and gaps to the candidate. Gaps are information for them, not
license to invent a claim that closes the gap. Bounded and inline — never
delegate this to a subagent or an open-ended research skill (`_shared.md` →
Subagent delegation).

---

## Privacy and confidentiality

Harvard: *"Don't share personal or proprietary data when using generative AI."*

For this project the operative risk is client confidentiality:

- **Never name a consulting client** in a resume, cover letter, or form answer
  unless the candidate explicitly confirms the name is public and cleared.
  Describe engagements by scale, industry, and outcome instead: "12 client
  engagements", "a regional healthcare provider".
- Never surface proprietary system names, internal project codenames, or
  customer data pulled from any source outside the candidate's own files.
