---
rfd: 10
title: Enums
state: committed
authors: [samifouad]
created: 2026-08-15
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Refs:** RFD 4 (errors), RFD 6 (match), RFD 9 (structs), RFD 13 (philosophy)
>
> This issue body is the RFD and is the canonical text. Comments below record decisions and earlier drafts; where they disagree with this body, this body wins.

# RFD 10: Enums

## Summary

Enums are named sum types with unit or payload-carrying variants, matched exhaustively (RFD 6). `Result` and `Option` are ordinary enums of this shape rather than compiler-privileged names — which is what makes RFD 4 a language guarantee instead of a built-in special case.

## Problem

DekaScript always wanted Rust-shaped enums: variants, payloads, exhaustive `match`. For a period the compiler could *consume* `Result` and `Option` but nobody could *declare* an enum, which made those two types a privilege rather than an example. A language whose error handling depends on a construct users cannot write has not really got that construct.

## Prior art

| Language | Model | Bearing |
|---|---|---|
| **Rust** | Enums with unit, tuple and struct variants; exhaustive `match` | The surface model. Struct variants are the one part deliberately not taken. |
| **Elm** | Custom types compiled to **frozen tagged plain objects**, tags treated as private | The runtime-representation model, adopted exactly. Elm's discipline — plain tagged objects, tags private and therefore optimisable, all external data through explicit codecs — is the precedent for the encode/decode rule below. |
| **Swift** | Enums with associated values, `indirect` for recursion | Nearest sibling. Its `indirect` keyword is the answer to recursive enums, a question this RFD has not yet had to face. |
| **Haskell** | Algebraic data types, the origin of the form | Where exhaustiveness and sum types come from. |
| **TypeScript** | Discriminated unions — structural, tag is an ordinary field | The contrast. Works without language support, and cannot stop you constructing the tag by hand, which is why ours is nominal. |
| **Java / C#** | Enums as named constants, no payloads | The weak form, and the reason "enum" alone is an ambiguous word. Worth naming so nobody arrives expecting it. |

## Specification

```ds
enum Status {
  Loading,
  Ready,
  Failed,
}

enum Msg {
  Text(string),
  Ping,
}

const current = Status.Ready
const m = Msg.Text("hi")
```

- Variants may be **unit** or carry a **payload**.
- `match` over an enum is exhaustive (RFD 6). A missing variant is a compile error unless `_` is present.
- Payload bindings are the only sanctioned way to reach inside a variant.

### `Result` and `Option`

```ds
enum Option<T> { None, Some(T) }
enum Result<T, E> { Ok(T), Err(E) }
```

`Ok`, `Err`, `Some` and `None` are bound as unqualified prelude aliases. Today the compiler injects these so every file can use them; the long-term home is `@deka/core` as ordinary DekaScript, with the compiler retaining them as lang items for diagnostics only.

The PHPX `Enum::Case` spelling is not DekaScript and is rejected by the parser.

### Runtime representation

Unit variants are frozen singletons, allocated once:

```js
const Status = Object.freeze({
  Loading: Object.freeze({ __enum: "Status", __case: "Loading" }),
  Ready:   Object.freeze({ __enum: "Status", __case: "Ready" }),
  Failed:  Object.freeze({ __enum: "Status", __case: "Failed" }),
});
```

Payload variants are plain functions, never classes:

```js
Text: (value) => Object.freeze({ __enum: "Msg", __case: "Text", value })
```

- `match` discriminates on `__enum` / `__case`, never `instanceof`. Tagged plain objects survive `structuredClone` and JSON; prototypes do not.
- **Tuple variants only.** Struct variants (`Rect { w: number, h: number }`) are out of scope — not deferred, skipped. A multi-field payload wraps a named struct (`Rect(Dimensions)`), which yields a reusable named type anyway. Purely additive if a real need appears.
- Prefer **named payload fields** (`Text(body: string)`) in public APIs so the runtime field has a stable name.
- **The representation is private** (RFD 13). Enum values may cross ephemeral boundaries freely — worker messages, isolates, always the same build. Durable storage (D1, KV, R2, anything surviving a deploy) requires an explicit encode/decode step. This is what keeps `__enum` / `__case` free to change, including a later move to integer tags.

## Rationale

**Why enums rather than compiler-privileged `Result`.** Two encodings mean two `match` lowerings and a permanent special case in the checker. More importantly, a privileged type cannot be imitated: users could not build their own `Either` or `Loaded<T>` with the same guarantees.

**Why tagged plain objects rather than classes.** Class identity does not survive `structuredClone`, JSON, or an isolate boundary, so `match` would break exactly where the runtime sends values. Elm reached this conclusion first and it is the reason the representation looks the way it does.

**Why tuple variants only.** Struct variants add a second payload shape, a second destructuring form, and a second exhaustiveness path, to express something a named struct already expresses.

## Alternatives considered

**Keep `Result` / `Option` as compiler magic.** Rejected: two encodings, two lowerings, permanent privilege, and no way for users to build equivalents.

**Classes or prototype-based variants.** Rejected: unstable identity across boundaries, and classes are a founding restriction.

**`{ ok: true, value }` for `Result`, tagged objects for user enums.** Rejected. One representation.

**Struct variants.** Skipped rather than deferred — see Rationale.

## Consequences

- Adding a variant is a breaking change at every `match` site. Intended.
- Moving `Result` / `Option` from prelude to `@deka/core` is a migration, not a redesign.
- Host wrappers still returning `{ ok, value }` or `{ __error }` instead of `Result` are debt against RFD 4 and must move onto this encoding.

## Open questions

1. **Generic enums do not typecheck.** `enum Box<T> { Item(T) }` parses — the AST carries `type_params` — but every typeck site destructures `Stmt::Enum { name, cases, .. }` and discards them, and `EnumInfo` stores only `cases`. So the parameter is never in scope and `Item(T)` reports ``unknown type `T` ``. Until this is fixed, `Result` and `Option` remain the only working generic bases, which is precisely the privilege this RFD exists to remove. **This is the highest-value item here** and should be a tracked compiler issue rather than an RFD question.
2. **Backing values** (`Red = "red"`) for serialisation. Later; encoding is a separate concern and the encode/decode rule above already covers the durable case.
3. **Freeze payload variants always, or only unit variants?** Today both are frozen. Settled by whether a measured allocation cost appears in a real workload.
4. **Recursive enums.** Not yet needed, and Swift's `indirect` is the prior art when it is.
