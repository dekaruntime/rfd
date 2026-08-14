#!/usr/bin/env bun
/**
 * Make each issue's label agree with its promoted file.
 *
 * Once an RFD is promoted the file is authoritative, and the site ignores the
 * label entirely. But GitHub still shows it, and still lets anyone change it —
 * so without this the issue page can say `discussion` while deka.gg says
 * `committed`, and nothing surfaces the disagreement.
 *
 * The file always wins. This never edits a file to match a label.
 *
 *   bun run sync-labels            # apply
 *   bun run sync-labels --dry-run  # report only
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

const REPO = 'dekaruntime/rfd'
const STATES = ['prediscussion', 'ideation', 'discussion', 'published', 'committed', 'abandoned']
const DRY = process.argv.includes('--dry-run')

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
if (!token) {
  console.error('sync-labels: GITHUB_TOKEN is required')
  process.exit(1)
}
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'user-agent': 'deka-rfd-sync-labels',
}

async function gh(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...init, headers })
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}

const dirs = readdirSync(process.cwd())
  .filter((n) => /^\d{4}-/.test(n) && statSync(join(process.cwd(), n)).isDirectory())
  .sort()

let changed = 0

for (const dir of dirs) {
  const readme = join(process.cwd(), dir, 'README.md')
  if (!existsSync(readme)) continue

  const { data } = matter(readFileSync(readme, 'utf8'))
  const number = Number(data.rfd)
  const state = String(data.state ?? '')
  if (!Number.isInteger(number) || !STATES.includes(state)) continue

  let issue: { labels: Array<{ name: string } | string>; state: string }
  try {
    issue = (await gh(`/issues/${number}`)) as typeof issue
  } catch (error) {
    // A promoted RFD whose issue is gone is odd but not worth failing a deploy
    // over — the file is authoritative regardless.
    console.warn(`  RFD ${number}: could not read issue (${(error as Error).message})`)
    continue
  }

  const current = issue.labels.map((l) => (typeof l === 'string' ? l : l.name))
  const keep = current.filter((l) => !STATES.includes(l))
  const desired = [...keep, state].sort()

  if (JSON.stringify([...current].sort()) === JSON.stringify(desired)) {
    console.log(`  RFD ${number}: already ${state}`)
    continue
  }

  const was = current.filter((l) => STATES.includes(l)).join(', ') || 'none'
  console.log(`  RFD ${number}: ${was} → ${state}${DRY ? ' (dry run)' : ''}`)
  changed++
  if (DRY) continue

  await gh(`/issues/${number}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labels: desired }),
  })

  // Say so in the thread once, so the transition has a visible record rather
  // than a label that silently changed colour.
  await gh(`/issues/${number}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body:
        `**RFD ${number} is now \`${state}\`.**\n\n` +
        `Set from [\`${dir}/README.md\`](https://github.com/${REPO}/blob/main/${dir}/README.md), ` +
        'which is the record for this RFD. This issue stays open as the discussion.',
    }),
  })
}

console.log(
  changed === 0
    ? 'sync-labels: every promoted RFD already agrees with its issue'
    : `sync-labels: ${changed} issue(s) ${DRY ? 'would be' : ''} updated`,
)
