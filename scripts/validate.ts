#!/usr/bin/env bun
/**
 * RFD validation gate.
 *
 * Runs on every pull request. An RFD that fails any check here cannot merge,
 * which is what keeps the published set trustworthy: every RFD on main is
 * guaranteed to parse, to be uniquely numbered, and to be attributable to a
 * real person.
 *
 * Exit codes: 0 = all valid, 1 = at least one problem.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

const ROOT = process.cwd()

/** YAML parses an unquoted `2026-08-14` into a Date, so accept both and
 *  normalise to YYYY-MM-DD. Requiring authors to quote dates is a footgun
 *  that would fail a PR for a reason nobody would guess. */
const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'must be a YYYY-MM-DD date')
const DIR_PATTERN = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*$/

export const STATES = [
  'prediscussion',
  'ideation',
  'discussion',
  'published',
  'committed',
  'abandoned',
] as const

/** The only shape an RFD's frontmatter may take. Unknown keys are rejected so
 *  a typo ("state" vs "status") fails loudly instead of silently defaulting. */
export const FrontmatterSchema = z
  .object({
    rfd: z.number().int().positive(),
    title: z.string().min(3).max(120),
    state: z.enum(STATES),
    authors: z.array(z.string().regex(/^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/))
      .min(1),
    created: isoDate,
    updated: isoDate.optional(),
    discussion: z.number().int().positive().optional(),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  })
  .strict()

export type Frontmatter = z.infer<typeof FrontmatterSchema>

const problems: string[] = []
const fail = (dir: string, msg: string) => problems.push(`${dir}: ${msg}`)

function rfdDirs(): string[] {
  return readdirSync(ROOT)
    .filter((name) => statSync(join(ROOT, name)).isDirectory())
    .filter((name) => /^\d{4}-/.test(name))
    .sort()
}

const seen = new Map<number, string>()

for (const dir of rfdDirs()) {
  if (!DIR_PATTERN.test(dir)) {
    fail(dir, 'directory must be NNNN-kebab-case-slug, e.g. 0007-package-signing')
    continue
  }

  const readme = join(ROOT, dir, 'README.md')
  if (!existsSync(readme)) {
    fail(dir, 'missing README.md — the RFD body lives there')
    continue
  }

  let data: unknown
  let body: string
  try {
    const parsed = matter(readFileSync(readme, 'utf8'))
    data = parsed.data
    body = parsed.content
  } catch (error) {
    fail(dir, `frontmatter will not parse: ${(error as Error).message}`)
    continue
  }

  const result = FrontmatterSchema.safeParse(data)
  if (!result.success) {
    for (const issue of result.error.issues) {
      fail(dir, `frontmatter.${issue.path.join('.') || '(root)'} — ${issue.message}`)
    }
    continue
  }
  const fm = result.data

  // The number is the identity. It must agree with the directory, because the
  // directory is what a human reads and the number is what every URL uses.
  const dirNumber = Number(dir.slice(0, 4))
  if (fm.rfd !== dirNumber) {
    fail(dir, `frontmatter rfd:${fm.rfd} does not match directory number ${dirNumber}`)
  }

  // Uniqueness is the one property that cannot be repaired after the fact:
  // two RFDs sharing a number means one of them has no stable URL.
  const clash = seen.get(fm.rfd)
  if (clash) fail(dir, `RFD number ${fm.rfd} is already used by ${clash}`)
  else seen.set(fm.rfd, dir)

  if (body.trim().length < 200) {
    fail(dir, 'body is under 200 characters — an RFD needs to state a problem')
  }

  if (fm.updated && fm.updated < fm.created) {
    fail(dir, `updated (${fm.updated}) is before created (${fm.created})`)
  }
}

if (rfdDirs().length === 0) {
  problems.push('no RFDs found — expected at least one NNNN-slug directory')
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ ${seen.size} RFD(s) valid: ${[...seen.keys()].sort((a, b) => a - b).join(', ')}`)
