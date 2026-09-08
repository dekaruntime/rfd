---
rfd: 4
title: Error Handling
state: committed
authors: [samifouad]
created: 2026-08-15
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Supersedes:** — · **Refs:** RFD 6 (match), RFD 7 (async), RFD 10 (enums), RFD 13 (philosophy), RFD 21 (`unsafe` is JS-mode)
>
> This issue body is the RFD and is the canonical text. Comments below record decisions and earlier drafts; where they disagree with this body, this body wins.

# RFD 4: Error handling

## Summary

Errors are values, absence is a value, and exceptions are not control flow. A function that can fail returns `Result<T, E>`; a value that may be missing is `Option<T>`. Both are ordinary enums, not compiler-privileged names. The JavaScript world beyond DekaScript throws, so `unsafe { }` is the one boundary where a throwing call is converted into a `Result` — nothing else in the language can raise.

## Problem

DekaScript rejects `try` / `catch` / `throw` at the parser. That is half a design. Removing exceptions is only coherent if the replacement is a value you can construct, inspect and exhaustively match — and if the host APIs that *do* throw have a defined way to meet that model rather than being unreachable.

Two failure modes if this is left implicit: two error channels coexist and every API has to document which one it uses; or `Result` exists as a convention that nothing enforces, so a `null` slips through and the guarantee is decorative.

## Prior art

| Language | Model | What we take, what we leave |
|---|---|---|
| **Elm** | `Result` / `Maybe`, no exceptions in the language at all | The closest model. Exhaustive `case`, errors as data, no escape hatch inside the language. Taken almost wholesale. |
| **Rust** | `Result<T, E>` / `Option<T>` enums, `?` propagation, `panic!` for unrecoverable | Enum representation and exhaustive match taken. `?` deferred (see Alternatives). No `panic!` equivalent — we have no unwinding to build it on. |
| **Haskell** | `Either e a` / `Maybe a`, monadic sequencing | Same shape, but do-notation needs a type class hierarchy we do not have and do not want. |
| **Go** | `(T, error)` multiple return | Rejected. Nothing forces inspection — `v, _ := f()` compiles, and the ignored-error class is Go's most-cited defect. Exhaustive match is the whole point. |
| **Swift** | `throws` + typed `try`, plus `Optional` with `?` sugar | Rejected for errors: it is still stack unwinding with a second channel. `Optional` sugar noted under Open questions. |
| **Zig** | Error unions `!T`, `try` propagates | Attractive and closest to Rust's `?`. Its error sets are nominal and global, which does not fit a structurally-typed language. |
| **TypeScript / JS** | Exceptions, untyped; `unknown` in `catch` since 4.4; `Promise` rejection as a second channel | The status quo we are replacing. Notably TS never got a `Result` — there is no way to make one enforceable without controlling the whole surface, which is exactly the advantage DekaScript has. |

**The distinctive part of this design is not `Result`** — six languages above have it. It is that `unsafe { }` is the single, named, greppable boundary where a throwing world becomes a `Result` world. The nearest analogue is Rust's `catch_unwind` at an FFI boundary, and unlike that, ours is the *only* way in.

## Specification

### Types

`Result` and `Option` are ordinary enums per RFD 10, not compiler-privileged names:

```ds
enum Option<T> { None, Some(T) }
enum Result<T, E> { Ok(T), Err(E) }
```

- A fallible function **MUST** return `Result<T, E>`.
- A possibly-absent value **MUST** be `Option<T>`.
- `Ok` / `Err` / `Some` / `None` are ordinary variant constructors, available from the prelude.
- There is **no** implicit unwrap. Reading a payload requires destructuring, normally via `match` (RFD 6).

```ds
const found = Some("Deka")

const message = match (found) {
  Some(value) => value,
  None => "nothing",
}
```

### Absence

- The `null` **literal** is rejected at its source. `Option<T>` is the only way to express absence.
- Comparisons against `null` are rejected.
- `T?` on a struct field means `Option<T>`, never `T | null`.

### Host APIs and `unsafe`

JavaScript's `JSON.parse`, `fetch` and friends throw. Two paths meet them, and only two:

1. **Safe wrappers** over a curated set of globals. A wrapper **MUST** return the prelude `Result`. A wrapper that returns a parallel `{ ok, value }` or `{ __error }` shape is a defect against this RFD.
2. **`unsafe { }` is JS-mode** (RFD 13 P6, RFD 21). The body is raw JavaScript. The expression evaluates to `Result<unknown, unknown>` — success is `Ok(completionValue)`, a thrown exception is `Err(error)`.

- `unsafe { … } catch` / `finally` is **not** part of the language. Inspection happens on the returned `Result`.
- `unsafe` is not a way to `throw` from DekaScript, and it does not introduce `any`.

### Async

- A fallible async function returns `Promise<Result<T, E>>`.
- Promise **rejection is not the error channel** (RFD 7). Host rejections are converted to `Err` by the safe wrappers or by `unsafe`.

### Enforcement

All of the above is compile-time. `match` is exhaustive; a variant payload cannot be reached without destructuring; `try` does not parse. The runtime carries tagged plain objects and re-checks nothing (RFD 13 P8).

Combinators (`map`, `and_then`, `unwrap_or`) are library functions, not keywords, and belong in `@deka/core` when it exists.

## Rationale

**Why enums rather than a bespoke `{ ok, value }` shape.** One encoding means one `match` lowering and no special cases in the checker. The bespoke shape was the original proposal and was withdrawn once RFD 10 landed — it would have been a second, parallel sum type in a language that already has one.

**Why the null literal is rejected at its source rather than only in comparisons.** Rejecting `x === null` while permitting `const a = null` leaves `Option` as a convention. Closing the literal is what converts this RFD from a style guide into a guarantee.

**Why `unsafe` returns `Result` rather than propagating.** Propagation would require a second control-flow mechanism — the thing this RFD removes. A `Result` at the boundary means the JS world's failure mode is expressible in the language's own vocabulary from the first line after the block.

## Alternatives considered

**Keep exceptions, add `Result` alongside.** Rejected: two error channels mean every API documents which one it uses, and callers must handle both. This is the JavaScript status quo and it is the problem.

**A Gleam-style class prelude for errors.** Rejected: class instances do not survive `structuredClone` or JSON, and classes are a founding restriction (RFD 13 P7).

**`{ ok: true, value }` as the `Result` shape.** Rejected once enums existed. Any wrapper still using it is a bug against this RFD.

**A `?` propagation operator (Rust / Zig).** Deferred, not rejected. `match` is sufficient for v1, and the noise `?` exists to remove is not yet real. Worth revisiting once `Result` is pervasive — the risk of adding it later is nil, since it is pure sugar over a `match`.

## Consequences

- Diagnostics that say *"Null comparisons are not allowed in PHPX"* inside a `.ds` file are defects — wrong language named.
- Safe `JSON.parse` / `fetch` wrappers must return the prelude `Result`.
- A user-authored object carrying the right `__enum` / `__case` tags is structurally indistinguishable from a real `Ok` at runtime. Accepted: checked code only constructs them through the variant constructors, and RFD 13's corollary already states the representation is not a contract.
- Every fallible stdlib signature is affected, so this wants to land before the stdlib surface grows rather than after.

## Open questions

1. **Does `Result` stay in the prelude permanently, or move to `@deka/core` once modules land?** Settled by deciding whether prelude membership is about ubiquity or about layering. `@deka/core` does not exist yet, so nothing is blocked.
2. **`Option` sugar.** Swift's `x?.y` and `x ?? default` are the two ergonomics people miss most. Neither is needed for v1 and both are additive; the question is whether they are ever wanted, given RFD 13 P9's one-obvious-way.
