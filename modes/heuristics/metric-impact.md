# Metric Impact Grading

A number on a resume is not automatically an achievement. "Built 4 dashboards"
is a number and conveys nothing. This file defines how to grade the metrics in a
generated CV or cover letter, and how to rework the weak ones **with** the
candidate rather than around them.

Origin: candidate requirement, 2026-08-19 — *"I don't want to include things
that aren't that remarkable."* This is not part of the Harvard MCS guidance in
`harvard-resume.md`; keep the attribution straight.

Mechanical pre-pass: `resume-lint.mjs` emits `no-metric` (no number at all) and
`weak-metric` (numbers present but small and static). Those flag candidates for
review. They do not decide anything — the grading below does.

---

## The rule that governs everything else

**Reworking a weak metric means finding the truth that was left out, never
manufacturing one.**

Permitted:

- Surfacing real context the bullet omitted (the before-state, the baseline, the
  counterfactual, what it unlocked)
- Reframing the same fact around consequence instead of activity
- Asking the candidate for a real figure they have not yet provided
- Cutting the bullet entirely when nothing notable is behind it

Forbidden, without exception:

- Raising or rounding a number to sound better
- Adding a superlative ("industry-leading", "record", "first-ever") that no
  source supports
- Implying broader ownership, scope, or team size than actually held
- Inventing a baseline so a percentage can be computed
- Keeping a figure the candidate cannot source

A `weak-metric` finding is resolved by a conversation or by deletion. It is
never resolved by editing the digits. On 2026-08-19 this project produced a
fabricated "4 benchmarking dimensions" figure under exactly this pressure — see
the incident note in `modes/_custom.md`.

---

## Grading

Grade each bullet that carries a metric. Impressiveness is **relative to the
peer group for the target role**, not absolute: 50 users is modest for a
platform engineering role and meaningful for an internal tool used by a
specialist team. Read the JD's seniority and scope first, then grade.

| Test | Question |
|---|---|
| **Scale** | Is the magnitude notable for this role's peer group? |
| **Delta** | Does it show a change the candidate caused, ideally before → after? |
| **Consequence** | Does it land on money, time, risk, reliability, or users? |
| **Differentiation** | Would most candidates interviewing for this role claim the same thing? |
| **Ownership** | Is it clear the candidate drove it rather than sat nearby? |

Verdicts:

- **Strong** — passes Delta or Scale, plus Consequence. Ship it.
  *"Cut manual deploy time from several hours to minutes across 10+ CI/CD pipelines."*
- **Adequate** — real scale but static, or a delta with no consequence named.
  Ship if space is tight; sharpen if the candidate has the missing half.
  *"Design ELT pipelines across 12 client engagements and 15 source systems."*
- **Weak** — small static count, activity rather than outcome, or
  indistinguishable from what any peer would write. Rework or cut.
  *"Enforced access policies for teams of up to 50 users."*

Activity-versus-impact is the distinction that catches most weak bullets: count
of things produced is activity; what changed because they existed is impact.

---

## Rework protocol

For each **Weak** bullet, do not ask the candidate "can you make this more
impressive?" — that question invites inflation and puts the work on them. Ask
the questions that extract the missing fact:

1. **Before-state** — "What was it like before you did this?"
   Turns a static count into a delta.
2. **Counterfactual** — "What would have happened if nobody had?"
   Surfaces avoided cost, avoided risk, avoided headcount.
3. **Relative scale** — "Is that a lot where you work? What's typical?"
   A number only reads as impressive with a reference point, and the candidate
   has one that the document does not.
4. **Downstream** — "What did that unlock for other people?"
   Converts a technical output into a business consequence.
5. **Difficulty** — "What made this hard? Who else could have done it?"
   Finds the differentiation, especially for work that sounds routine.
6. **Recognition** — "Did anyone notice? Was it adopted, extended, cited?"
   Adoption is evidence of value when no metric exists.

Then present a concrete rewrite for approval, showing what changed and which
answer it came from. If none of the six produce anything real, say so plainly
and recommend cutting the bullet: a short resume of strong bullets beats a full
one padded with routine work. That recommendation is a legitimate outcome of
this process, not a failure of it.

---

## Reporting

Present grading as a table before the render, weakest first, so the candidate
sees the judgment rather than a silently edited document:

```
| Bullet (abbrev.) | Metric | Verdict | Why | What would strengthen it |
```

Include **Strong** rows too — the candidate should be able to see that the
rest of the document was checked, not just the problems. Keep the table to the
bullets actually going on this CV; do not grade the whole of `cv.md`.

Any bullet whose rework produces a new fact must have that fact written back to
`cv.md`, so the stronger version is reused rather than re-derived on the next
application (same capture-once rule as the metric and skill-verification gates).

---

## Qualifier variety

Candidate observation, 2026-08-20: a resume built entirely out of "X+" reads as
templated rather than written, even when every figure is a real benchmark. Mix
`X+`, `over X`, and `more than X` across the document — and a bare number with
no qualifier at all is a legitimate fourth option when the figure is exact
rather than a floor. `resume-lint.mjs`'s `qualifier-repetition` check flags a
document using `X+` four or more times with no variation; treat it the same as
any other `warn` finding — vary the phrasing, don't just accept the warning.

This is a candidate style preference, not a Harvard MCS rule — keep the
attribution separate from `harvard-resume.md`.
