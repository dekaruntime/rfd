---
rfd: 30
title: Pipelines
state: committed
authors: [samifouad]
created: 2026-08-25
updated: 2026-09-08
tags: []
---
This issue body is the RFD. Comments below may describe earlier drafts.

# RFD: Pipelines

## Problem

DekaScript already has `|>`. The tour, the formatter, and the JS emitter agree on a desugar:

```
a |> f        =>  f(a)
a |> f(b)     =>  f(a, b)
```

Typecheck does not. `5 |> add(1)` is diagnosed as `add(): expected at least 2, got 1` because the call is arity-checked *before* the pipe inserts `5`. The operator we shipped cannot take extra arguments, so every interesting pipeline dies at the first binary function.

That also leaves no way to pipe into a slot that is not the first argument. Without that hole, we will either twist APIs into an unnatural order or fall back to lambdas (`fn(x) { f(1, x) }`), which is the fluent-builder problem in another hat.

RFD 13 lists `|>` as an addition (JavaScript has no opinion). It does not specify the rules. This RFD does.

## Proposal

Adopt Gleam’s pipeline, in full: **pipe-first, subject-first, function captures with `_`.**

Louis Pilfold’s design is the one that fits an uncurried, subject-first language. F#/Elm need currying, which we do not have. Hack/TC39 need a placeholder on every step, which we do not want. PHP 8.5 is unary-only, which is what we have today by accident and it is not enough.

### Desugar

1. If the right-hand side is a **function capture** (a call containing `_`), apply the left-hand value to that capture.
2. Else if the right-hand side is a **call**, insert the left-hand value as **argument 0**.
3. Else treat the right-hand side as a function and **call it** with the left-hand value as its only argument.

```ds
rocket |> launch(1, 2)     // launch(rocket, 1, 2)
rocket |> launch           // launch(rocket)
"1" |> append("3", _)      // append("3", "1")
```

Typecheck **after** desugar. `5 |> add(1)` is `add(5, 1)`. The current diagnostic is a bug against this RFD.

Emit what we already emit for (2) and (3). Captures emit as a one-argument function:

```js
append("3", _)   =>  (function(__pipe) { return append("3", __pipe); })
```

then (1) is ordinary application. No runtime pipe helper (RFD 13 principle 1).

### Function captures

`_` in **argument position** of a call is a hole, not an identifier.

```ds
const add1 = add(1, _)     // fn(x: number) number { return add(1, x) }
10 |> add(1, _)            // 11
```

Rules:

- Exactly **one** `_` per capture. Two holes is a compile error (`add(_, _)` is not a two-arg function; write `fn(a, b) { add(a, b) }`).
- `_` is a **direct** argument of that call. Nested `f(g(_), 1)` is a compile error.
- A capture is a value of type `fn(T) U`, where `T` is the type of the hole and `U` is the callee’s return type.
- `_` in a `match` arm remains the wildcard pattern. The two uses are different positions; they do not clash.
- Bare `_` as an expression (`const x = _`) is a compile error.

Captures exist **everywhere**, not only on the right of `|>`. That is Gleam. The pipe escape hatch is just “use a capture as the RHS.” We do not invent a second pipe form.

Do **not** take Gleam’s old heuristic “if the first argument does not typecheck, wrap as a sole argument instead.” If first-arg is wrong, the programmer writes `_`. Diagnostics say that (RFD 13 principle 10).

### Subject first

A pipeline is only readable if the thing flowing is argument 0.

```ds
fn launch(rocket: Rocket, pad: number, delay: number) { ... }
fn append(s: string, suffix: string) string { ... }   // subject first
fn toBe(received: T, expected: T) { ... }             // subject first
```

This is a **library convention** the language makes cheap, the same way Elixir `Enum.map(list, fn)` and Gleam `list.map(list, fn)` put the collection first. Methods already do this: the receiver is the subject (`fn (p Point) magnitude()`).

Consequences for authors:

- Stdlib, `@deka/test`, and user functions that want to pipe put the data first, options after.
- Methods stay method calls (`p.magnitude()`). Do not write `p |> magnitude`. Pipe is for functions.
- When an order we do not control puts the subject later (a JS-shaped host helper, a function we will not churn), `_` is the hatch: `x |> decrypt(key, nonce, _, aad)`.

We will not add a second operator (`->>`, pipe-last). One obvious way (RFD 13 principle 9). The hatch is `_`, not another `|>`.

### What this is not

- Not currying. `add(1)` remains a wrong-arity **call**, not a function waiting for the next argument. The only way to wait is `_`.
- Not method chaining. `expect(x).toBe(y).ok()` is still the JS habit. Pipe + subject-first functions replace it.
- Not a placeholder on every step. `x |> f(^, 1)` is Hack. We insert first by default.

## Alternatives considered

**Unary pipe only (`x |> f`, extra args via `fn(x) { f(x, 1) }`).** That is PHP 8.5 and today’s typechecker. Rejected: the lambda is noise, and it is what we are trying to get off the testing API.

**F# reverse-apply, extra args by currying (`x |> add 1`).** Rejected: DekaScript is not curried. `add(1)` cannot change meaning (RFD 13: redefine never).

**Hack/TC39 placeholder always (`x |> f(^, 1)`).** Most general, and it fights subject-first: every step names the hole even when the hole is obvious. Rejected for v1. `_` exists for the non-first case.

**Pipe-last (Haskell, Clojure `->>`).** Rejected: methods and the packages are already subject-first. Two operators is two ways.

**Gleam’s fallback “try first arg, else wrap.”** Rejected: silent arity games. `_` is explicit.

**`_` only legal on the RHS of `|>`.** Tempting smaller surface. Rejected: Gleam’s `const add1 = add(1, _)` is independently useful, and the hatch should be one construct, not a pipe-only special case.

## Consequences

- Typecheck of `Call` must see the **desugared** argument list when the call sits on the right of `|>`. `crates/php-rs/.../check/collect.rs` is the present failure.
- Emitter already implements (2) and (3). Captures are new emit: a one-arg function, no `globalThis` helper.
- `_` as a call argument is new syntax. Hats and the tour need cases: first-arg insert, bare name, capture in pipe, capture as a value, two holes fail, nested hole fail, match `_` still works.
- Stdlib argument order becomes a real constraint. New `@deka/*` functions put the subject first. Existing packages that put options first are debt to flip or to call with `_`.
- [RFD 29](https://github.com/dekaruntime/rfd/issues/29) (Behaviour Driven Testing) can be functions in a pipeline (`value |> toBe(3)`, `sha256(abc) |> toBeOk |> toEqual(bytes)`) instead of a Jest matcher object.

## Open questions

1. Capture emit name: a fresh `__pipe` parameter is an implementation detail and must not leak into diagnostics. Confirm.
2. Is `console.log` as `x |> console.log` (rule 3, property fetch) something we keep? The formatter already prints it. It is useful and a bit JS-shaped. I would keep it.
3. Should a capture be allowed to close over `let` mut state? Yes — it is an ordinary `fn`.
