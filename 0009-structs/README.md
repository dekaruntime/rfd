---
rfd: 9
title: Structs
state: committed
authors: [samifouad]
created: 2026-08-15
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Refs:** RFD 4 (Option), RFD 13 (philosophy), RFD 19 (interfaces, receivers, embedding), RFD 22 (immutability)
>
> This issue body is the RFD and is the canonical text. Comments below record decisions and earlier drafts; where they disagree with this body, this body wins.

# RFD 9: Structs

## Summary

Structs are DekaScript's named records and the replacement for classes. They are **nominal** — two structs with identical fields are two types — with bare `name: Type` fields, no `$`, no inheritance. Shared shape is expressed through interfaces (RFD 19); shared implementation through embedding.

## Problem

Structs carried PHPX field syntax (`$x: int`) into a language that bans `$` in expressions. That is not a design decision, it is leftover grammar, and it forces every user to learn two rules for one concept.

The larger question the syntax obscured: are structs nominal or structural? The answer determines whether `Point` and `Vec2` with the same fields are interchangeable, and it has to be stated rather than inferred from the checker's behaviour.

## Prior art

| Language | Model | Bearing |
|---|---|---|
| **Go** | Nominal structs, **embedding rather than inheritance**, methods with explicit receivers | The direct model. Embedding-not-inheritance and named receivers instead of implicit `this` are both taken. |
| **Rust** | Nominal structs, no inheritance, traits for shared behaviour | Same nominal stance. Its `..base` functional-update syntax is the prior art for the open question below. |
| **Swift** | Value-semantic structs, `mutating` methods | The closest analogue to our `const`/`let` distinction — mutability is a property of the binding and the method, not the type. |
| **TypeScript** | Structural. `interface Point` and `interface Vec2` with the same fields are the same type | The contrast, and the thing most users will expect. Rejected for types; adopted for interfaces (RFD 19), which is where structural typing belongs. |
| **OCaml / Elm** | Records with functional update — `{ r with x = 1 }` | Direct prior art for struct update syntax. Both make it a first-class form rather than spread, which avoids the "what does a duplicate key mean" question spread has. |

## Specification

```ds
struct Point {
  x: number
  y: number
}

const origin = Point { x: 0, y: 0 }
let cursor = Point { x: 10, y: 20 }
```

### Types

- Structs are **nominal**. Two structs with identical fields are distinct types (RFD 13 P4). Shared shape goes through an interface (RFD 19).
- No inheritance. Embedding promotes fields and methods; it is specified in RFD 19 and not repeated here.

### Fields

- A field is spelled `name: Type`. `$` is not part of the syntax.
- Separators may be newline, comma or semicolon. Examples and the formatter teach **one** style — newline, no trailing separator.
- `email: string?` means `Option<string>` (RFD 4). An omitted optional field is `None`.

```ds
struct User {
  name: string
  email: string?
}

const u = User { name: "Deka" }   // email is None
```

### Mutability

`const` bindings are immutable, `let` bindings are mutable (RFD 22):

```ds
origin.x = 5   // compile error
cursor.x = 5   // ok
```

### Construction

- The constructor is the type name followed by a field literal: `Point { x: 3, y: 4 }`.
- A missing required field is a compile error.
- An unknown field is a compile error.

### Runtime representation

A struct declaration compiles to a factory:

```js
const Point = deka.Struct("Point");
```

Instances carry a non-enumerable `__deka_struct` tag so `match` and `deka.isStruct` can identify them. `const` composite values are deep-frozen. Method bodies attach to the factory prototype; mutable methods go through `implMut` and raise `deka.MutationError` if the receiver is frozen.

**This representation is private** (RFD 13). Durable storage must encode and decode; it must not read `__deka_struct`.

## Rationale

**Why nominal.** Structural equality of named types means `Celsius` and `Fahrenheit` with one `number` field are the same type, which removes the reason to name them. Interfaces give the structural behaviour where it is actually wanted — describing a shape a caller requires — without making every named type interchangeable.

**Why embedding rather than inheritance.** Inheritance couples layout, identity and dispatch in one mechanism. Go's experience is that embedding covers the reuse cases without the fragile-base-class problem, and it composes with a structurally-typed interface system rather than fighting it.

**Why no `$`.** It is banned in expressions already. Requiring it in declarations means the language has two rules for one concept and every example has to teach both.

## Alternatives considered

**Keep `$x: int`.** Rejected: that is the PHPX migration path, not the language.

**Make structs structural.** Rejected in RFD 13 P4. Interfaces are the structural contract.

**Classes.** Rejected as a founding restriction. No hidden `this` — a receiver is always named. No inheritance — use embedding.

## Consequences

- Examples, the tour and the formatter teach `x: number`, never `$x`.
- Parser diagnostics that still say *"must use `$name: Type` syntax in PHPX"* inside a `.ds` file are defects — wrong language named.
- Schema and database annotations (`@id`, `@relation`) exist on struct fields in the typechecker. They are out of scope here and belong with the data layer.
- Nominality means a struct cannot be satisfied by an object literal of the right shape. That is the point, and it is the thing TypeScript users will be surprised by.

## Open questions

1. **Are mixed field separators worth rejecting?** Newline, comma and semicolon all parse today. Settled by deciding whether the formatter normalising them is sufficient, or whether the parser should refuse. Lower stakes than it looks — the formatter can enforce one style without a language rule.
2. **Struct update syntax.** `Point { ...p, x: 1 }` does **not** compile today. The question is whether to add it, and in which form. Rust's `..base` and OCaml/Elm's `{ r with x = 1 }` are both first-class forms that avoid spread's duplicate-key ambiguity; JavaScript spread is the familiar form that carries it. Settled by whether immutable update becomes a common shape in practice — RFD 22 makes it more likely than it would otherwise be.
