# Requests For Discussion

Significant changes to deka are proposed, argued over and recorded here before
they are built.

Published at **[deka.gg/rfd](https://deka.gg/rfd)** — the site builds directly
from `main`.

## Reading

Every RFD is a directory: `NNNN-kebab-slug/README.md`. The number is permanent
and is the RFD's identity — `deka.gg/rfd/7` will always be RFD 7.

## Proposing one

```sh
bun install
bun run new "Short specific title"   # picks the next free number
bun run validate                     # the same gate CI runs
```

Then open a pull request. Anyone may propose an RFD; see
[RFD 1](0001-rfd-process/README.md) for how the process works.

## States

`prediscussion` → `ideation` → `discussion` → `published` → `committed`, or
`abandoned` at any point. Abandoned RFDs stay published — deleting a decision's
history is how a project ends up making it twice.

## Validation

Pull requests are gated. An RFD cannot merge unless it parses, has complete and
correctly typed frontmatter with no unknown keys, uses a known state, carries a
number matching its directory that no other RFD holds, and is attributed to
GitHub accounts that actually exist.
