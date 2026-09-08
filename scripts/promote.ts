#!/usr/bin/env bun
/**
 * Promote an accepted RFD from an issue to a file.
 *
 *   bun run promote 39
 *   bun run promote 39 --state committed
 *
 * Pulls issue #39 from GitHub and writes 0039-slug/README.md with the
 * frontmatter filled in from the issue itself — number, title, author, date.
 * Nothing is invented and nothing is typed twice, so the file cannot disagree
 * with the issue it came from.
 *
 * The issue stays open. It is still where the discussion lives; the file is
 * now the record, and further changes go through pull requests that reference
 * it.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO = 'dekaruntime/rfd'
const STATES = ['prediscussion', 'ideation', 'discussion', 'published', 'committed', 'abandoned']
type State = (typeof STATES)[number]

function isState(value: string | undefined): value is State {
  return value !== undefined && STATES.includes(value as State)
}

const args = process.argv.slice(2)
const arg = args[0]?.replace(/^#/, '')
if (!arg || !/^\d+$/.test(arg)) {
  console.error('usage: bun run promote <issue-number> [--state <state>]')
  process.exit(2)
}
const number = Number(arg)

const stateFlag = args.indexOf('--state')
const requestedState = stateFlag === -1 ? undefined : args[stateFlag + 1]
if (
  (stateFlag !== -1 && (stateFlag !== 1 || !isState(requestedState))) ||
  args.length !== (stateFlag === -1 ? 1 : 3)
) {
  console.error(`state must be one of: ${STATES.join(', ')}`)
  process.exit(2)
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
const headers: Record<string, string> = {
  accept: 'application/vnd.github+json',
  'user-agent': 'deka-rfd-promote',
}
if (token) headers.authorization = `Bearer ${token}`

const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${number}`, { headers })
if (!res.ok) {
  console.error(`could not fetch issue #${number}: ${res.status} ${res.statusText}`)
  if (res.status === 403) console.error('rate limited — set GITHUB_TOKEN')
  process.exit(1)
}

const issue = (await res.json()) as {
  number: number
  title: string
  body: string | null
  created_at: string
  user: { login: string } | null
  labels: Array<{ name: string } | string>
  pull_request?: unknown
}

if (issue.pull_request) {
  console.error(`#${number} is a pull request, not an RFD`)
  process.exit(1)
}

const labels = issue.labels.map((l) => (typeof l === 'string' ? l : l.name))
const issueStates = labels.filter((l) => STATES.includes(l))
if (!requestedState && issueStates.length > 1) {
  console.error(
    `RFD ${issue.number} has multiple state labels: ${issueStates.join(', ')}. ` +
      'Remove the ambiguity or pass --state <state>.',
  )
  process.exit(1)
}
const state = requestedState ?? issueStates[0] ?? 'published'
const tags = labels.filter((l) => !STATES.includes(l))

const slug = issue.title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60)
  .replace(/-$/, '')

const padded = String(issue.number).padStart(4, '0')
const dir = join(process.cwd(), `${padded}-${slug}`)
if (existsSync(dir)) {
  console.error(`${padded}-${slug}/ already exists — RFD ${issue.number} is already promoted`)
  process.exit(1)
}

const author = issue.user?.login ?? 'unknown'
const created = issue.created_at.slice(0, 10)
const today = new Date().toISOString().slice(0, 10)

const frontmatter = [
  '---',
  `rfd: ${issue.number}`,
  `title: ${issue.title}`,
  `state: ${state}`,
  `authors: [${author}]`,
  `created: ${created}`,
  `updated: ${today}`,
  `tags: [${tags.join(', ')}]`,
  '---',
  '',
].join('\n')

mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'README.md'), `${frontmatter}${issue.body ?? ''}\n`, 'utf8')

console.log(`promoted RFD ${issue.number} → ${padded}-${slug}/README.md`)
console.log('')
console.log('  next:  bun run validate')
console.log(`         git checkout -b rfd-${issue.number} && git add ${padded}-${slug}`)
console.log(`         git commit -m "promote RFD ${issue.number}: ${issue.title}" && open a PR`)
console.log('')
console.log(`  the issue stays open — it is still the discussion for RFD ${issue.number}.`)
