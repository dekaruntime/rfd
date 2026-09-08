---
rfd: 12
title: Modules
state: committed
authors: [samifouad]
created: 2026-08-15
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Refs:** RFD 5 (package index), RFD 13 (philosophy)
>
> This issue body is the RFD and is the canonical text. Comments below record discussion; where they disagree with this body, this body wins.

# RFD 12: Modules

## Summary

DekaScript's module system is ESM in syntax and semantics, with three deliberate divergences: no default exports, no dynamic `import()` of computed strings, and resolution that goes through the lockfile and nowhere else. There is no filesystem search and no ambient lookup — a module graph that cannot be known statically cannot be audited, tree-shaken or frozen.

## Problem

The module system behaves *much like* ESM, and "much like" was doing a lot of work in that sentence. None of the divergences were written down, so each one was discovered rather than taught: a user reaches for `export default`, gets an error, and has no document explaining whether that is a bug or a decision.

The second half of the original problem — that relative imports did not resolve at all (deka#44) — **is fixed**. `crates/deka_compile/src/module_graph.rs:124` handles `./` and `../`. Multi-file DekaScript works through the CLI.

## Prior art

| System | Resolution model | Bearing |
|---|---|---|
| **Cargo** | Registry-first, lockfile mandatory, dependency graph declared in `Cargo.toml`; no filesystem search for packages | The closest match to this design, and evidence that mandatory-lockfile resolution is workable rather than austere. |
| **Node (CommonJS/ESM)** | `node_modules` walk up the directory tree, conditional exports, dual formats | The anti-model. Ambient upward lookup is the surface a closed package universe exists to exclude. |
| **Deno** | URL imports, no resolution algorithm at all, integrity via lockfile | Proves resolution can be fully explicit. Its retreat toward `deno.json` and JSR is evidence that *fully* explicit at every call site is too far — the same lesson recorded in RFD 5. |
| **Go** | Module path prefix determines everything; no relative-vs-package distinction; `go.sum` notarises | Directly relevant to RFD 5's index model. Shows a large ecosystem with no central resolution authority. |
| **Python** | `sys.path`, mutable at runtime, shadowing by accident | The strongest cautionary case for why resolution must not be ambient or reorderable. |
| **Bun / esbuild** | Node-compatible resolution, plus bundler-time overrides | Where "one obvious way" erodes: every override mechanism is another way a specifier can mean two things. |

## Specification

### Syntax and semantics are ESM

Named imports and exports, `export fn`, `export const`, live bindings, one evaluation per module, no circular-import behaviour beyond what ESM already specifies. Familiarity is the feature.

### Divergences

- **No default exports.** A named export is greppable and renameable; a default is neither, and it creates the "what do I call this?" question at every import site.
- **No dynamic `import()` of an arbitrary string.** Same reasoning as no `eval`: a module graph that cannot be known statically cannot be audited, tree-shaken or frozen.
- **Resolution is lockfile-first.** Every non-relative specifier resolves through the lockfile and the installed module directory. No `node_modules` algorithm, no upward directory traversal, no ambient global resolution. A closed package universe with an escape hatch is not closed.

### Relative imports

A `.ds` file importing `./sibling.ds` resolves within the project. Supported.

## Rationale

**Why no default exports.** The cost is a papercut when porting JavaScript-shaped code. The benefit is that every exported name is the same name at every import site, which makes the codebase greppable and refactorable — disproportionately valuable in a constrained surface (RFD 13 P9).

**Why lockfile-first rather than a search path.** Every search-path resolver eventually answers "which file did this import actually load?" with "it depends." Python's `sys.path` and Node's `node_modules` walk both produce shadowing bugs that are invisible in the source. Explicit resolution means the answer is in a file you can read and diff.

**Why static imports only.** This is the same restriction as no `eval`, for the same reason, and it is what makes tree-shaking and a frozen package set possible at all.

## Alternatives considered

**Node-style resolution.** Familiar, and immediately reintroduces the ambient-lookup surface the platform exists to exclude.

**Allow default exports.** Familiar. Rejected for greppability, and because a constrained surface benefits disproportionately from one obvious way to name things.

**Relative-only, no registry.** Simple, and forfeits versioning and integrity. The registry is the distribution model (RFD 5).

## Consequences

- No code runs without a lockfile. Already true in practice; worth owning as a decision rather than meeting as an error message.
- No default export is a real papercut when porting JavaScript, and belongs in the migration guide.
- Static-only imports foreclose lazy-loading a module by computed name. If that is ever needed it must arrive as a declared capability, not a dynamic string.
- The installed-module directory is still named `php_modules/` (`crates/bundler`, `crates/cli/src/cli/build.rs`, `publish.rs`). PHPX is gone; the name is a leftover and will read as confusing to any new contributor.

## Open questions

1. **Re-exports** — is `export { x } from "…"` supported? Needs verification rather than debate.
2. **Namespace imports** — is `import * as arr` supported, and does it survive tree-shaking? The second half matters more: a namespace import that defeats elimination is a footgun in a language that promises graph-level shaking.
3. **Relative-import spelling** — with or without the `.ds` extension, and is one canonical? Note this interacts with `.dsx` (RFD 24), which makes an extensionless spelling ambiguous.
4. **Rename `php_modules/`.** A mechanical change with a migration cost for existing projects, and the longer it waits the higher that cost. Settled by deciding whether to take it before or after going public.

*Removed as resolved: whether `.ds` and `.phpx` modules interoperate during the migration. There is no migration and no `.phpx`.*

