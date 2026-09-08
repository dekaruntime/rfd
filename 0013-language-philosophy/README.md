---
rfd: 13
title: Language Philosophy
state: committed
authors: [samifouad]
created: 2026-08-16
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Refs:** every language RFD appeals to this one · **Amendment pending:** P1/P8 for named types (see Open questions)
>
> This issue body is the RFD and is the canonical text. Comments below record decisions and earlier drafts; where they disagree with this body, this body wins.

# RFD 13: Language philosophy

## Summary

The standing principles for DekaScript language decisions. Later RFDs appeal to these rather than re-deriving them. They are normative: a change that violates a principle needs a superseding RFD, not an exception in a pull request.

## Problem

DekaScript was making language decisions in chat logs, commit messages and people's heads. That works while one person holds the context and fails the moment a decision has to be justified, revisited, or made by someone else — including an agent.

When principles are unwritten, every decision is re-litigated from scratch and inconsistencies accumulate quietly, because nothing makes them visible.

## Prior art

| Document | Model | Bearing |
|---|---|---|
| **TypeScript Design Goals** | A short list of goals *and explicit non-goals* — notably "do not add runtime type information" and soundness as an explicit non-goal | The closest analogue and the most useful one. Its power comes from the non-goals: they are what let maintainers say no with a citation. Principles 6 and 9 do the same work here. |
| **Go proverbs / "Go at Google"** | Short aphorisms backed by a longer rationale paper | Demonstrates that a memorable form and a rigorous form are both needed — the aphorism gets quoted, the paper settles arguments. |
| **Zen of Python (PEP 20)** | Aphorisms, deliberately unenforced | The cautionary case. "There should be one obvious way" is principle 9 almost verbatim, and Python did not hold to it. A principle without a gate is a wish, which is the argument for the conformance gates below. |
| **Elm** | One guarantee — no runtime exceptions — held absolutely | Evidence that a single unbreakable guarantee is worth more than many soft ones, and that holding it constrains everything downstream. |
| **Oxide RFDs** | Written decisions as the unit of engineering record | The process precedent, adopted in RFD 1. |

**What this document does that the others do not:** it is paired with executable conformance gates, so a principle is checkable rather than quotable. That is a direct response to the Python case.

## The principles

1. **Impose as little runtime overhead as possible.** Behavioural guarantees must not be paid for at runtime by every program.

2. **Emit clean, idiomatic, recognizable JavaScript.** A developer should be able to read the output and recognise their own program in it.

3. **Where DekaScript and JavaScript express the same thing, they behave the same.** We diverge by *refusing* things, never by giving familiar syntax unfamiliar meaning.

4. **Named types are distinct. Interfaces are structural.** Two structs with the same fields are still two types. An interface is a shape: any value with the required fields and methods satisfies it, with no `implements` declaration.

5. **Strike a balance between correctness and simplicity. Prefer simplicity when in doubt.**

6. **Guard rails cannot be removed.** No `any`, no `as`, no ignore-comments. TypeScript needs those because it must compile existing JavaScript; we have no such corpus.

   `unsafe { }` is **not an exception to this principle** — it is outside its scope. Its body is raw JavaScript, not DekaScript: the typechecker treats it as opaque and the expression evaluates to a `Result` (RFD 21). It does not introduce `any`, does not silence a diagnostic, and does not make null, `throw` or classes reachable in DekaScript. It is the boundary to a host that throws, and this principle governs everything on this side of it. Frequently used host APIs get DS-native imports over time; `unsafe` exists so we do not have to wrap the entire web platform first.

7. **Restrict freely. Add sparingly. Redefine never.**
   - *Restrictions* (no null, no throw, no classes, no arrow functions) — free to take. Code that passes always behaves as a JavaScript developer expects.
   - *Additions* where JavaScript has no opinion (`match`, `|>`, `Result`, `fn`) — safe, because there is no existing expectation to violate.
   - *Redefinitions* — same syntax as JavaScript, different rules. Approximately never.

8. **Enforce at compile time. The runtime carries data, not guarantees.** Exhaustiveness, absence, error handling and type safety are the typechecker's job. The runtime represents values faithfully and does not re-check them.

9. **One obvious way.** Where two constructs would serve the same purpose, we ship one. A constrained surface is the product.

10. **Diagnostics are part of the language.** A misleading error message is a defect. If the compiler rejects something, it must say what is wrong and what to do instead.

### Corollaries

- **Internal representation is private.** Tags such as `__enum`, `__case` and `__deka_struct` are implementation details, not a contract. Durable storage goes through an explicit encode/decode step so the representation can change. Follows from 1 and 3.
- **Imports over ambient globals.** Library capability arrives through the module graph. Host and browser APIs that throw are reached through `unsafe { }` until a DS-native import exists. Follows from 1 and 9.
- **Untrusted input is not a named type.** JSON, HTTP bodies and worker messages stay dynamic until a decoder validates them and the program *constructs* a named value. Shape alone does not make a `Point`. Follows from 4.
  - **The decoder boundary is the nominal boundary.** Nominal inside DekaScript, opaque outside. This is the same encode/decode boundary durable storage already requires (RFD 10) — one door serving two purposes, with trust established exactly where representation is converted. It closes the hole that makes structural typing unsafe at boundaries, where untrusted input becomes a trusted type by accident of shape.

### What this settles

- **`if` is a statement; `match` is an expression.** JavaScript already has `if`. It has no `match`. An `if` expression would also overlap `match` (principle 9).
- **No implicit last-expression return.** Rust's `x` versus `x;` distinction redefines familiar syntax (7) and makes diagnostics dangerous (10).
- **`fn` is the only function keyword.** No `function`, no arrow functions (9). `fn` is an addition; the others are refused.
- **`Result` / `Option` are tagged values, not classes.** Principles 1 and 8.
- **Async functions declare `Promise<T>` explicitly.** A restriction, not a redefinition (7).
- **A `Vec2` is not a `Point`.** Both may satisfy `interface { x: number, y: number }`. Interfaces are the structural contract; struct names matter at typed boundaries (4).
- **`unsafe { }` is JS-mode.** How you call browser and host APIs that throw. Not an exception to principle 6 and not a type-system opt-out — the body is JavaScript, so principle 6 does not reach inside it.
- **Call syntax follows JavaScript.** A space before `(` is already the same as JS (`echo ("hello")`). Juxtaposition (`echo "hello"`) would be a later *addition* under principle 7, not a keyword special-case for `echo`.

### Enforcement

These principles are rendered as a Handbook, which informs the Tour. **Each principle should be backed by an executable conformance gate**, so the Handbook's claims are enforced rather than asserted — a principle with no check is a wish. The first two gates are diagnostic snapshot tests (principle 10) and an emission budget (principle 1).

## Alternatives considered

**TypeScript's stated goals, adopted directly.** Principles 1–3 are deliberately close. Rejected as a whole because TypeScript's explicit non-goal is soundness — it trades correctness for the ability to compile all existing JavaScript. We have no such obligation.

**Rust's model — expression-oriented, everything a value.** Internally coherent. Rejected as a whole: it conflicts with principle 3 wherever JavaScript already has an opinion. We take Rust's ideas in the type system, where JavaScript is silent, and JavaScript's in control flow, where it is not.

**Fully structural typing, including named structs.** Tempting and simpler to explain. Rejected under principle 4 — see the decoder-boundary corollary for why it is unsafe where it matters most.

**A general-purpose `unsafe` that opts out of the language.** Considered and rejected during discussion, and the reasoning is worth keeping: Rust's `unsafe` unlocks operations the compiler *cannot* verify — raw pointers, unions, FFI. DekaScript's guard rails are a different kind of thing. No null, no throw, no classes are not "the compiler cannot check this", they are "we chose not to allow this". An escape hatch from a design choice becomes the path of least resistance under delivery pressure. What survives is the narrow JS-mode `unsafe` of principle 6 — a boundary to a throwing host, not an opt-out. If real FFI or raw memory access ever lands on the native VM path, revisit under a precise name (`extern` / `ffi`), never a general `unsafe`.

**No written philosophy; decide case by case.** The status quo this RFD replaces.

## Consequences

- Principles can be amended, but by a superseding RFD or an accepted amendment, not by exception in a pull request.
- Principle 6 means we will not add `any`, `as` or ignore-comments under delivery pressure.
- Principle 9 means saying no to features that overlap existing ones.
- Existing behaviour that violates these principles is debt: diagnostics that still say "PHPX" inside `.ds` files, "Missing semicolon" for unsupported constructs, leftover ambient prelude.
- Because later RFDs cite these principles by number, **renumbering is a breaking change** to every document that cites them. Amendments should change wording in place.

## Open questions

1. **The P1/P8 amendment for named types is proposed and unaccepted**, and this is the most consequential open item here. deka#346 (newtypes) is written against the *amended* wording and is being implemented, so the shipped design and this document currently disagree. The proposal narrows rather than repeals: P1 becomes "not paid for by programs that do not use them", P8 becomes "the runtime carries identity, not verification". Full text is in the amendment comment below. **Settled by accepting, rejecting or revising it** — leaving it open is the one outcome that keeps the contradiction live.
2. **How far should excess-property checking go** for interface-typed object literals outside JSX?
3. **Which principles have gates today, and what is the plan for the remaining eight?** The enforcement section commits to gates; only two are named. This is the difference between this document and PEP 20.

*Resolved and folded into the body: nominal typing at the decoder boundary (now a corollary), the general-`unsafe` question (now in Alternatives with its reasoning), and the Handbook decision (now the Enforcement section).*
