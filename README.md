# Requests For Discussion

Significant changes to deka are proposed, argued over and recorded here.

Published at **[deka.gg/rfd](https://deka.gg/rfd)**, which shows every RFD —
those still under discussion as well as those that have been accepted.

## Proposing one

**Open an issue.** That is the whole process. Every issue in this repository is
an RFD; there is no label to add and no triage step.

The issue number is the RFD number, permanently. Issue #39 is RFD 39 and lives
at `deka.gg/rfd/39`.

## Lifecycle

State is a label on the issue:

    prediscussion → ideation → discussion → published → committed
                                          ↘ abandoned

An issue with no state label is treated as `prediscussion`. An issue with two
is an error and fails the site build.

## Promotion

Once an RFD is accepted it is promoted to a file in this repository:

```sh
bun install
bun run promote 39      # writes 0039-slug/README.md from issue #39
bun run validate        # the same gate CI runs
```

Then open a pull request. From that point the file carries the state, changes
go through pull requests that reference the issue, and **the issue stays open**
as the discussion.

**If a file exists, the file wins.** The site takes a promoted RFD's state and
body from the file; the issue remains the conversation.

## Why both

While an RFD is being argued about, a threaded discussion is a better artifact
than a diff, and proposing one should cost a text box. Once it is a decision
the project depends on, "what changed and who objected" matters more than
convenience — which is what a pull request gives you.

Friction matches commitment. See RFD 1.
