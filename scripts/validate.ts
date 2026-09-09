#!/usr/bin/env bun
/**
 * Validate the canonical RFD records: open GitHub issues in dekaruntime/rfd.
 *
 * The issue body and exactly one lifecycle label are the only source of an
 * RFD's text and state. There are intentionally no checked-in RFD copies to
 * reconcile with the issue API.
 */
const REPO = 'dekaruntime/rfd'
export const STATES = [
  'prediscussion',
  'ideation',
  'discussion',
  'published',
  'committed',
  'abandoned',
] as const

type Issue = {
  number: number
  title: string
  body: string | null
  labels: Array<{ name: string } | string>
  pull_request?: unknown
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
const headers: Record<string, string> = {
  accept: 'application/vnd.github+json',
  'user-agent': 'dekaruntime-rfd-validate',
}
if (token) headers.authorization = `Bearer ${token}`

async function openIssues(): Promise<Issue[]> {
  const issues: Issue[] = []
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100&page=${page}`,
      { headers },
    )
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} ${response.statusText}`)
    }

    const batch = (await response.json()) as Issue[]
    issues.push(...batch)
    if (batch.length < 100) return issues
  }
}

const problems: string[] = []
let rfds: Issue[] = []

try {
  rfds = (await openIssues()).filter((issue) => !issue.pull_request)
} catch (error) {
  console.error(`\n✗ could not read canonical RFD issues: ${(error as Error).message}\n`)
  process.exit(1)
}

for (const rfd of rfds) {
  if (rfd.title.trim().length < 3) {
    problems.push(`RFD #${rfd.number}: title must contain at least 3 characters`)
  }
  if (!rfd.body?.trim()) {
    problems.push(`RFD #${rfd.number}: issue body is empty`)
  }

  const labels = rfd.labels.map((label) => (typeof label === 'string' ? label : label.name))
  const states = labels.filter((label) => (STATES as readonly string[]).includes(label))
  if (states.length !== 1) {
    problems.push(
      `RFD #${rfd.number}: expected exactly one lifecycle label ` +
        `(${STATES.join(', ')}), found ${states.length === 0 ? 'none' : states.join(', ')}`,
    )
  }
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} RFD issue problem(s):\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ ${rfds.length} open RFD issue(s) valid`)
