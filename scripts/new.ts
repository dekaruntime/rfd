#!/usr/bin/env bun
/**
 * Scaffold the next RFD.
 *
 * Picks the next free number by reading the working tree. Two people running
 * this at the same time can still pick the same number — that is fine and
 * expected. The validator is what makes a collision impossible to *merge*;
 * this only makes it unlikely to *happen*.
 *
 *   bun run new "Package signing and release distribution"
 */
import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const title = process.argv.slice(2).join(' ').trim()
if (!title) {
  console.error('usage: bun run new "<title>"')
  process.exit(2)
}

const ROOT = process.cwd()

const used = readdirSync(ROOT)
  .filter((n) => statSync(join(ROOT, n)).isDirectory() && /^\d{4}-/.test(n))
  .map((n) => Number(n.slice(0, 4)))

const next = used.length === 0 ? 1 : Math.max(...used) + 1
const padded = String(next).padStart(4, '0')

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60)
  .replace(/-$/, '')

const dir = join(ROOT, `${padded}-${slug}`)
if (existsSync(dir)) {
  console.error(`${dir} already exists`)
  process.exit(1)
}

const author = process.env.GITHUB_HANDLE ?? '<your-github-handle>'
const today = new Date().toISOString().slice(0, 10)

const body = `---
rfd: ${next}
title: ${title}
state: prediscussion
authors: [${author}]
created: ${today}
tags: []
---

# RFD ${next}: ${title}

## Problem

## Proposal

## Alternatives considered

## Consequences
`

mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'README.md'), body, 'utf8')

console.log(`created ${padded}-${slug}/README.md`)
if (author.startsWith('<')) {
  console.log('set GITHUB_HANDLE to have your handle filled in automatically')
}
