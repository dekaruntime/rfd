---
rfd: 41
title: Type Coercion & Interrogation
state: committed
authors: [samifouad]
created: 2026-09-02
updated: 2026-09-08
tags: []
---
> **State:** discussion · **Refs:** rfd#40 (Extending Primitives — "superpowers"), rfd#13 (philosophy), rfd#25 (Schema Validation), rfd#21 (Platform Globals), deka#153, deka#346, deka#252, deka#363/#364, deka#378, deka#460 (`unsafe<T>`)

# Type Coercion & Interrogation

## Summary

DekaScript can **convert** some values between primitive types, can **ask nothing** about a value's type, and **cannot check** what `unsafe<T>` actually returned. This RFD proposes one mechanism that addresses all three, and records the design conversation that produced it.

## Ground truth — measured against released 0.39.0

**Coercion is asymmetric and half-built:**

```
string(5)        ->  string            total
number("5")      ->  Option<number>    partial
boolean(x)       ->  unknown identifier
bytes(x)         ->  unknown identifier
```

**Interrogation does not exist:** `is_string`, `typeof`, `x is string` — none parse.

**Unions do not exist.** No `Type::Union`, no parser support.

**`unsafe<T>` is an unchecked assertion:**

```ds
const r = unsafe<number> { "definitely a string" }   // [ok] checked
```

The annotation is a claim. Nothing verifies it, so a lie enters the type system as truth. This is currently the one place DekaScript's guarantees are *asserted* rather than *checked*.

## What is wrong with `number(x)`

It conflates three operations, with three return types, invisibly at the call site:

```ds
number("42")     // Option<number>  — parse, can fail
number(celsius)  // number          — unbox a newtype
number(true)     // number          — widen
```

`UnwrapKind` already carries `WidenToNumber` and `StringToOptionNumber` as separate lowerings because of this. Unions would add a fourth meaning — *"is this already a number?"* — to the same name.

**Gleam and Elm solve this with no methods at all**: `int.parse` and `int.to_string` are simply different functions. So the coercion cleanup is **not blocked on rfd#40**; only its ergonomics are.

## Proposal

### `super` — one keyword, one meaning: this survives erasure

```ds
super fn validate<T>(json: string) Result<T, string> {
  let expected = T.type()
  // walk `json` against `expected`
}
```

**Marked on the function, not on type parameters.** The obligation belongs to the code that needs runtime types, not scattered across its callers as bounds.

**It does not propagate.** `validate<User>(json)` just works — the compiler knows `T = User` at the call site, walks the type, and emits the descriptor tree. No `<T: super>`, no `super struct`, no cascading errors.

That is deliberate, and the reason is Rust's async `Send`: a requirement introduced at the top that propagates to every leaf, surfacing errors far from the cause, with no recourse for types you do not own. **`Send` must propagate because it is a *proof obligation* — the compiler cannot synthesize thread-safety.** `super` is only *information retention*: the compiler already knows the shape, and is merely choosing whether to emit it. Nothing needs proving, so nothing needs propagating.

**Limit:** a type the compiler cannot describe — one holding a function value, or itself derived from `unsafe` — is an error at that specific call site, not a viral constraint.

### Reflection

```ds
let something: number | string
something = "hello world"

something.signature()          // number | string   — the DECLARED type
something.getType()            // Type              — the RUNTIME type
something.getType().toString() // "string"          — for humans
```

`.signature()` is a compile-time rewrite to a literal: the static type is erased, but the compiler knows it at the call site.

`.getType()` returns a **first-class `Type` value**, not a string — matching Java `getClass()`, C# `GetType()`, Go `reflect.TypeOf()`, Python `type()`. A string would be dead-end; a value is programmable, which is what the schema system needs.

Inside a `super fn`, `T.type()` yields the descriptor for the type parameter. **The capability comes from the function being `super`, not from a global.** An ambient `type_of<T>()` would reintroduce exactly what rfd#21 and deka#378 exist to remove.

Method chaining already works — verified on structs at 0.39.0 — and falls out of rfd#40's static dispatch for free, since an extension method is a compile-time rewrite to a free function and chaining is just nesting.

### Reflection is not narrowing

| | audience | mechanism | narrows? |
|---|---|---|---|
| **narrowing** | everyday code | `match` type-patterns | **yes** — tests and binds |
| | | `x.as<number>()` → `Option` | **yes** — binds through Option |
| **reflection** | stdlib, schema, libraries | `.getType()`, `.signature()` | **no** |

A string comparison cannot narrow:

```ds
if (v.type() == "string") {
  // v is STILL `number | string` here
}
```

The compiler receives a *boolean* and has no way to connect it back to `v`. Narrowing requires **binding** — which is why every modern language does test-and-bind in one construct, and why the newer ones (Swift, Java 16+, C#) prefer rebinding over flow-sensitive smart casts. DekaScript has no flow-sensitive typing anywhere and `match` arms already rebind, so rebinding is both cheaper and more modern here.

**The narrowing half needs nothing from rfd#40.** `match (v) { string(s) => …, number(n) => … }` is syntax, and syntactically identical to the enum-case patterns `match` already handles.

### `super unsafe<T>` — closing the assertion hole

```ds
let user = super unsafe<User> { JSON.parse(raw) }
```

Validates the returned value against `User`'s descriptor before wrapping in `Ok`, so a malformed payload becomes `Err` — which is what `unsafe` returning a `Result` was always for.

Opt-in, because checking every crossing is real work. Plain `unsafe<T>` keeps today's assert-only behaviour.

## Why one mechanism rather than three

The descriptor serves all of it:

| | uses the descriptor to |
|---|---|
| `validate<T>` | check external data against a named type |
| `super unsafe<T>` | check what JS actually returned against the claim |
| union narrowing | decide which arm a value matches |

**This is the thing TypeScript cannot do and Gleam will not.** TS has the industry's most elaborate narrowing and still cannot validate runtime data, so every serious codebase carries zod and declares its types twice, in two syntaxes that drift. Gleam went the other way — no unions, no narrowing, decoders only.

Doing both from one source of truth is available to us **only while every type has a decidable predicate**. That is an argument for keeping unions restricted, and a warning that TS-grade type-level machinery later would silently destroy the property.

## Prior art

### Coercion

| Language | Total | Fallible | Fallibility marked by |
|---|---|---|---|
| Rust | `From`/`Into` | `TryFrom` → `Result`, `.parse::<T>()` | separate trait |
| Swift | `Int(3.9)` | `Int("42")` → `Int?` | failable initializer |
| Kotlin | `x.toString()` | `s.toIntOrNull()` | name suffix |
| Scala | `x.toString` | `s.toIntOption` | name suffix |
| Gleam | `int.to_string(x)` | `int.parse(s)` → `Result` | return type only |
| Elm | `String.fromInt` | `String.toInt` → `Maybe` | return type only |
| Go | `strconv.Itoa` | `strconv.Atoi` → `(int, error)` | return type only |
| TS/JS | `String(x)` | — | none (`NaN`) |
| **DS today** | `string(x)` | `number(s)` → `Option` | return type only, invisible at the call site |

No exceptions and no null puts DekaScript in the Gleam/Elm column **by construction** — the Kotlin/Scala "throwing variant plus safe variant" pattern has no meaning without a throwing variant, which deletes `OrNull`-style naming entirely.

**Rust's `as` is the instructive negative**: the one entry with silent data loss (`300u32 as u8 == 44`), widely regretted, and exactly the shape of a "convenient universal conversion operator." Named here as the thing not to build.

### Interrogation

| Language | Test + bind | Style |
|---|---|---|
| TypeScript | `typeof`, `instanceof`, `x is Foo` | flow-sensitive |
| Kotlin | `if (x is String)` | flow-sensitive (smart cast) |
| Swift | `if let s = x as? String` | **rebinds** |
| Java 16+ | `if (o instanceof String s)` | **rebinds** |
| C# | `if (o is String s)` | **rebinds** |
| Rust | `Any::downcast_ref::<T>()` | deliberately rare |

| Library-level | Mechanism |
|---|---|
| Gleam | `gleam/dynamic` + decoders; no language interrogation at all |
| Elm | `Json.Decode`, decoders as values |
| TS in practice | zod / io-ts — third-party, because narrowing cannot validate runtime data |

**Nobody designing this recently exposes a bare `typeof`-returning-a-string as the primary mechanism.**

## Sequencing

```
rfd#40 "superpowers"  ── ergonomics of coercion        optional
                      └─ a home for .getType()          required for reflection

rfd#41 this           ── coercion cleanup               ships standalone today
                      ├─ reflection (super, getType)    needs rfd#40
                      └─ narrowing (match patterns)     needs neither

Unions                ── needs narrowing, not reflection
```

## Open questions

- **Naming:** `x.getType()` vs `T.type()` — two spellings for closely related things. Keep distinct (different receivers) or unify?
- **Can a library construct a `Type`?** `Type.union(number, string)` — deferred; not required for validation.
- **Cost visibility.** With no declaration-site marking, bundle impact is driven by use and is not visible from a declaration. A build report naming emitted descriptors would restore it.
- **`boolean()` and `bytes()`** — absent by decision or unfinished?

## Recommendation

Adopt `super` as described. Ship the coercion cleanup independently and first, since it is unblocked. Treat unions as a separate RFD that this one enables.

-claude

