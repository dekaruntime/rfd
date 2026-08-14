---
rfd: 1
title: The RFD process
state: committed
authors: [samifouad]
created: 2026-08-14
tags: [process, meta]
---

# RFD 1: The RFD process

## Problem

Significant decisions about deka were being made in chat logs, commit messages
and people's heads. Six months later nobody can reconstruct why an approach was
chosen, so the same argument gets had again — and outside contributors have no
way to see the reasoning at all, let alone take part in it.

## Proposal

Every significant change is written up as an RFD in this repository before it is
built. An RFD states the problem, proposes a direction, records the alternatives
that were rejected and why, and names what the decision commits us to.

### Source of truth

The markdown file on `main` is the only source of truth. Frontmatter carries the
state; the website derives everything it displays from it. Discussions, pull
requests and issues are pointers to conversation — they never hold state.

This matters because anything stored in two places eventually disagrees, and a
process whose own status is ambiguous is worse than no process.

### Numbering

An RFD's number is its identity and is permanent. The directory is
`NNNN-kebab-slug` and `rfd:` in the frontmatter must match it. Numbers are never
reused and never renumbered, including for abandoned RFDs, because `/rfd/7` must
mean RFD 7 for as long as the link exists.

Authors pick the next free number with `bun run new "<title>"`. Two people can
still pick the same one; validation is what makes a collision impossible to
merge, and the fix is a rebase and a bump.

### States

    prediscussion → ideation → discussion → published → committed
                                          ↘ abandoned

`abandoned` RFDs stay published. Deleting a decision's history is how a project
ends up making it twice.

### Validation

Every pull request is gated. An RFD cannot merge unless it parses, carries a
frontmatter schema with no unknown or missing fields, uses a state from the list
above, has a number matching its directory that no other RFD holds, and is
attributed to GitHub accounts that actually exist.

The last check is deliberate: this repository previously displayed three RFDs
credited to people who do not exist. Attribution is now enforced by the machine
rather than by good intentions.

### Publishing

deka.gg builds directly from `main`. If the fetch fails or any RFD is malformed,
**the build fails** rather than publishing a page with the broken RFD missing —
a silently empty list is the failure nobody notices.

## Alternatives considered

**Markdown files in the website repository.** What existed before. It kept RFDs
behind a private repo, so the public could not read proposals, let alone submit
one. It also meant the process only existed as far as someone remembered to
follow it.

**GitHub Discussions as the source of truth.** Lower friction to start, but a
discussion thread cannot be diffed, reviewed line by line, or required to pass a
check before it counts. Discussions remain the place to argue; the file is the
place the decision lives.

**One branch per RFD, as Oxide does.** The model this process is drawn from, and
stronger for a large team running many concurrent RFDs. It needs tooling to
reconcile branch state against published state, which is more machinery than a
project this size can justify today. Merging early to `main` and moving state
forward in later pull requests gets most of the benefit.

## Consequences

- Every accepted RFD is reviewable, diffable and permanently addressable.
- Contributors can propose changes without access to any private repository.
- Deciding something now costs a written document, which is the point: the cost
  is paid once, instead of every time the question comes back.
- The website gains a hard dependency on this repository being well-formed,
  which is why validation is a merge gate rather than a linting suggestion.
