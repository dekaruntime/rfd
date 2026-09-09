# Requests For Discussion

Significant Deka changes are proposed, discussed, and recorded as GitHub
issues in this repository. The issue body and its one lifecycle label are the
authoritative RFD record and are published at
[deka.gg/rfd](https://deka.gg/rfd).

## Process

Open an issue with the RFD template. Its number is the permanent RFD number:
issue #39 is RFD 39 and lives at `deka.gg/rfd/39`. Write and revise the design
in the issue body; discussion stays in the issue thread.

Every open RFD must carry exactly one state label:

    prediscussion → ideation → discussion → published → committed
                                          ↘ abandoned

`committed` records an accepted decision directly on the issue. It does not
create a second Markdown record or a promotion pull request. Implementation
pull requests link back to the RFD; they do not become the RFD's source.

State can move in either direction as the design changes. Closing an issue
removes it from the published RFD index; use `abandoned` when a rejected or
superseded decision should remain visible.

The validator fails when an open RFD has zero or multiple lifecycle labels, so
the website never guesses at its state. See [RFD 1](https://github.com/dekaruntime/rfd/issues/1)
for the complete process.
