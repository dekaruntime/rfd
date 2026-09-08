---
rfd: 5
title: Package Index
state: committed
authors: [samifouad]
created: 2026-08-15
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Refs:** RFD 12 (modules), RFD 13 (philosophy)
>
> This issue body is the RFD and is the canonical text. Comments below record discussion; where they disagree with this body, this body wins.

# RFD 5: Package Index

## Summary

Deka distributes packages through an **index**, not a registry. There is no central authority that owns names, adjudicates disputes, or approves publication. An exact locator — a git-speaking URL — always resolves. A short unscoped name resolves only through a versioned, signed alias catalog, and an alias is a redirect, never a location.

## Problem

A package system needs a name-to-code mapping, and the default shape for that is a registry: accounts, reserved handles, ownership, moderation. That shape brings costs the project does not want and cannot afford — name squatting, disputes over who owns `http`, an account system to maintain, and the position of gatekeeper over an ecosystem.

It also brings a security shape we specifically reject. A central registry is a single mutable point that every install trusts, which is the mechanism behind the entire npm supply-chain class.

The requirement is to get short, memorable names for the packages that deserve them, without becoming the arbiter of who deserves them.

## Prior art

| System | Model | Bearing on this design |
|---|---|---|
| **Go modules** | Import paths *are* URLs (`github.com/user/repo`). No central registry. `GOPROXY` caches, `sum.golang.org` notarises. | The model being adopted. Proves a large ecosystem works with no name authority. Its cost — long import paths everywhere — is what the alias catalog exists to soften. |
| **Nix flakes** | Flake refs are URLs, plus a **registry of aliases** mapping `nixpkgs` → `github:NixOS/nixpkgs`. | The closest existing analogue to the two-tier design here, including the alias-as-redirect semantics. Worth studying before finalising the catalog format. |
| **npm** | Central registry, flat namespace, first-come ownership. | The anti-model. Name squatting, ownership disputes, and a single trusted mutable point are all structural rather than incidental. |
| **JSR** (Deno) | Scoped-only — every package is `@scope/name`, no unscoped names exist. | Solves squatting by construction, at the cost of never having a short name. We want the short names, which is why the catalog exists. |
| **Deno 1.x** | Bare URL imports, no manifest. | Went further than this RFD and retreated: URLs at every call site proved unergonomic, which is evidence that exact locators alone are insufficient. |
| **Maven** | Reverse-DNS coordinates (`com.example:artifact`). | No squatting because you must control the domain. Principled, verbose, and the domain-ownership idea is a live alternative to a curated catalog. |
| **crates.io** | Central, flat, first-come. | Same squatting exposure as npm, mitigated socially rather than structurally. |

## Specification

### Two ways to name a package

**Exact locator** — a scoped name that *is* the location. Always resolves, with no catalog involvement and no approval:

```
deka add @pkg.deka.gg/array
deka add @github.com/samifouad/networkMap
```

**Unscoped alias** — a short name resolved through the alias catalog:

```
deka add array        →  @pkg.deka.gg/array
deka add dzod         →  @github.com/somedude/dzod
```

### Rules

1. **Exact locators always work without catalog approval.** The catalog is a convenience layer; it is never a gate on installation.
2. **Unscoped aliases never fuzzy-match and never fall back.** An alias either resolves through the catalog or fails. A miss is an error, not a search.
3. **The alias catalog is versioned and signed.** "Blessing" is a trust and discovery statement, not publication approval — the package is already installable by its locator.
4. **An alias resolves to the same immutable canonical package for the life of a lockfile.** Re-resolution across catalog versions is a lockfile change, visible in a diff.
5. **The canonical source of an alias is displayed** wherever the alias is — CLI output and the deka.gg package pages. A short name must never hide where the code comes from.
6. **Project-local shadowing of a blessed alias is rejected.** Allowing a project to redefine `array` locally is a supply-chain footgun with no legitimate use that an exact locator does not already serve.

### The host requirement

Resolution requires a host that speaks **git over HTTPS**. This is not tailored to GitHub; any git-speaking host is a valid locator target.

### The stdlib uses the same mechanism

`array` → `@pkg.deka.gg/array` is an ordinary catalog entry. The standard library gets short names through the identical path a blessed third-party package does, with no privileged resolution path. If the mechanism is not good enough for the stdlib, it is not good enough.

## Rationale

**Why an index and not a registry.** The properties we want from short names — memorability and discovery — do not require owning the namespace. Separating *where the code is* from *what it is called* means the authority question ("who owns `http`") never has to be answered, because the alias is a redirect that can be re-pointed and the locator underneath is unambiguous.

**Why blessing is discovery, not permission.** If a catalog entry were required to install, the catalog would be a registry with extra steps and every incentive of one. Because an exact locator always works, blessing can be curated as tightly as we like without becoming a gate.

**Why no fallback on an alias miss.** A resolver that falls back is a resolver that can be steered. Silent fuzzy matching is the mechanism behind typosquatting; an error is the correct answer to a name that is not in the catalog.

## Alternatives considered

**Be a registry.** Rejected — accounts, moderation, disputes and a single trusted mutable point, in exchange for nothing the index does not provide.

**Scoped-only, no aliases (JSR).** Eliminates squatting entirely and is the simplest secure answer. Rejected because short names for the stdlib are worth a curated catalog, and because Deno 1.x demonstrated that locators-everywhere is a real ergonomic cost.

**Domain-ownership naming (Maven).** Attractive: no catalog needed, and ownership is externally verifiable. Rejected as the primary scheme for verbosity, but it remains the natural fallback if the catalog proves contentious to curate.

**Allow local alias overrides.** Rejected under rule 6. The legitimate need — pinning a fork — is served by an exact locator, which is visible in the manifest.

## Consequences

- A curated catalog is an ongoing editorial commitment. It is small and it is a judgement call each time, and it should be treated as a standing cost rather than a one-off.
- Signing the catalog requires a key and a verification path in the CLI. That work is shared with any other signed-artifact work and should not be duplicated.
- Unscoped names are a finite resource. Once `array` is blessed it should be treated as permanent; re-pointing a live alias to a different canonical package silently changes what existing code means.
- An unofficial "cool packages" list by anyone else is fine and expected. Nothing in the design privileges ours except that we sign it.

## Open questions

1. **`deka add` does not exist.** The shipped CLI has `install`, `publish` and `pkg` (`crates/cli/src/cli/`). Either this RFD adopts `deka install`, or `add` is introduced as the user-facing verb and `install` becomes its alias. Settled by deciding which verb the docs teach.
2. **Catalog format, storage and signing key.** Where the catalog lives, how it is versioned, and which key signs it. Settled alongside whatever key custody scheme the CLI's other signed artifacts use — this should not invent a second one.
3. **Alias retirement.** What happens when a blessed package is abandoned. Rule 4 makes existing lockfiles safe; the question is what a *new* resolution of a retired alias does. Recommend: hard error naming the last canonical locator, never a silent re-point.
4. **Relationship to the deka.gg package pages.** Whether the catalog is generated from the site's data or the site renders the catalog. One should be the source.
