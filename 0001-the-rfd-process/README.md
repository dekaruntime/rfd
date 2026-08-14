---
rfd: 1
title: The RFD process
state: committed
authors: [samifouad]
created: 2026-08-14
updated: 2026-08-14
tags: []
---
## Problem

Decisions about deka were being made in chat logs, commit messages and people's
heads. Six months later nobody can reconstruct why an approach was chosen, so
the same argument gets had again. Outside contributors could not see the
reasoning at all, let alone take part.

An earlier attempt at an RFD process failed for the opposite reason: it was a
process nobody could enter. RFDs lived as hardcoded entries in the website's
source, behind a private repo, credited to three people who do not exist.

## Proposal

Two homes, and the lifecycle decides which one an RFD is in.

### Every issue in this repository is an RFD

There is no `rfd` label and no triage step. Opening an issue here *is*
proposing an RFD. Bug reports about the tooling belong in the repository the
tool lives in.

This makes proposing one cost a text box. It also makes attribution
unforgeable — the author is a GitHub account, not a string somebody typed.

### The issue number is the RFD number

Issue #39 is RFD 39, permanently, and `deka.gg/rfd/39` is its address.

GitHub assigns numbers atomically, so two people cannot collide no matter how
simultaneously they file. Nothing in our tooling assigns or validates numbers,
because there is nothing left to get wrong.

The cost is gaps: pull requests share the same counter, so the sequence will
read 4, 17, 39. That is cosmetic and worth it. This RFD is itself the first
gap — number 1 was consumed by a test pull request while the system was being
built.

### Labels carry the state, up to a point

    ISSUE  prediscussion → ideation → discussion ──┐
                                                   │  promotion (a pull request)
    FILE                     published → committed ┘
                                                   ↘ abandoned (either side)

**`published` and `committed` are not labels you can apply to an issue.** They
belong to files. Accepting an RFD means promoting it and opening a pull
request; a label cannot commit the project to anything, because a label has no
author, no diff and no reviewer.

Labelling an unpromoted issue `committed` fails the site build, with a message
telling you to promote it instead.

An issue with no state label is treated as `prediscussion` — someone opened it,
so it exists, and the absence of a label is not a reason to hide it.

An issue with two state labels is an error and fails the build. A lifecycle
that can be in two states at once is not a lifecycle.

### Accepted RFDs are promoted to files

Once an RFD is settled it becomes `NNNN-slug/README.md` in this repository,
with the same number. From then on:

- The **file** carries the state in its frontmatter.
- Changes go through **pull requests** that reference the original issue.
- The **issue stays open** as the discussion thread.

Promotion is where the trade flips. While an RFD is being argued about, a
threaded discussion is a better artifact than a diff. Once it is a decision the
project relies on, "what changed, and who objected" matters more than
convenience — and that is exactly what a pull request gives you.

### If a file exists, the file wins

The single rule that keeps the two homes from disagreeing. A promoted RFD's
state comes from its frontmatter and its body comes from the file; the issue is
demoted to being the conversation.

The site honours that rule, but GitHub does not — it still shows the label and
still lets anyone change it. So a workflow syncs each promoted RFD's label to
its file whenever `main` changes, and comments on the issue when the state
moves. The file is never edited to match a label; the correction only runs one
way.

Without this, an issue page can read `discussion` while deka.gg reads
`committed`, and nothing anywhere surfaces the contradiction.

### The site shows all of them

deka.gg/rfd renders both sources, merged by number. An RFD under discussion is
as visible as one that shipped, because "what are they arguing about right now"
is most of what makes an RFD index worth reading.

## Alternatives considered

**Files only, with numbering we assign.** The first version of this. It needed
a validator to enforce unique numbers, a scaffolding command to pick the next
free one, and a merge gate to make collisions impossible to land — all to
rebuild something GitHub already does atomically. It also put a clone, a
branch and a pull request between a person and a half-formed idea.

**Issues only.** Simpler still, and nearly right. But an accepted RFD is a
document the project depends on, and issue edits silently overwrite. You cannot
review a change to a decision line by line, and the content lives in a database
we do not control rather than a repository we can clone.

**GitHub Discussions as the source.** Better shaped for open-ended argument,
but discussions cannot be required to pass a check, and they have no
relationship to a file. Discussions stay available for conversation that is not
a proposal.

### Committing to something is a pull request

Because `committed` is a file state, the act of accepting an RFD is merging a
pull request that promotes it. That gives the decision what a label cannot: an
author, a diff, a reviewer, a timestamp, and somewhere to write down why.

`CODEOWNERS` already restricts who can merge, so the authority was always
there — this names it.

## Consequences

- Proposing an RFD costs a text box; accepting one costs a pull request.
  Friction matches commitment.
- Numbers are permanent and never reused, so links never rot. The sequence has
  gaps.
- The published set is only as good as the promotion step: an RFD that is
  decided but never promoted stays a comment thread. The build now catches the
  most common version of that mistake — labelling instead of promoting.
- deka.gg gains a hard dependency on this repository. The site build fails
  closed rather than publishing a page with RFDs missing.
- Issue bodies are rendered on deka.gg, so they are sanitised before display.
  Anyone with a GitHub account can put anything in one.

