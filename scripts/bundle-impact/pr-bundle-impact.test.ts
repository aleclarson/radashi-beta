import { expect, test, vi } from 'vitest'
import { run } from './pr-bundle-impact'
import { dedent } from './src/dedent'
import { weighChangedFunctions } from './src/weigh-changed'

vi.mock('./src/weigh-changed')

test('adds the bundle impact to the PR body', async () => {
  const pulls: Record<string, { body: string }> = {
    'radashi-org/radashi#1': {
      body: dedent`
        ## Summary

        This is a summary of the PR.
      `,
    },
  }

  const env = {
    context: {
      repo: {
        owner: 'radashi-org',
        repo: 'radashi',
      },
      issue: { number: 1 },
    },
    github: {
      rest: {
        pulls: {
          get({
            owner,
            repo,
            pull_number,
          }: {
            owner: string
            repo: string
            pull_number: number
          }) {
            return Promise.resolve({
              data: pulls[`${owner}/${repo}#${pull_number}`],
            })
          },
          update: vi.fn(),
        },
      },
    },
    core: {
      info: vi.fn(),
      setFailed: vi.fn(),
    },
  }

  vi.mocked(weighChangedFunctions).mockResolvedValue(
    dedent`
      | Status | File | Size | Difference (%) |
      | --- | --- | --- | --- |
      | M | src/foo/bar.ts | 110 | +10 (+10%) |
    `,
  )

  await run(env)

  expect(env.github.rest.pulls.update).toHaveBeenCalled()
  expect(env.core.info).toHaveBeenCalled()
  expect(env.core.setFailed.mock.calls).toEqual([])

  expect(env.github.rest.pulls.update.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          "body": "## Summary

    This is a summary of the PR.

    ## Bundle impact

    | Status | File | Size | Difference (%) |
    | --- | --- | --- | --- |
    | M | src/foo/bar.ts | 110 | +10 (+10%) |

    ",
          "owner": "radashi-org",
          "pull_number": 1,
          "repo": "radashi",
        },
      ],
    ]
  `)
  expect(env.core.info.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "fetching PR #1 data from radashi-org/radashi...",
      ],
      [
        "calculating bundle impact...",
      ],
      [
        "updating PR description...",
      ],
      [
        "PR description updated with bundle impact.",
      ],
    ]
  `)

  // Now that we've tested adding the "Bundle Impact" section, let's test
  // updating that section upon a subsequent run.
  vi.mocked(weighChangedFunctions).mockResolvedValue(
    dedent`
      | Status | File | Size | Difference (%) |
      | --- | --- | --- | --- |
      | M | src/foo/bar.ts | 120 | +20 (+20%) |
    `,
  )

  env.github.rest.pulls.update.mockClear()

  await run(env)

  expect(env.github.rest.pulls.update.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          "body": "## Summary

    This is a summary of the PR.

    ## Bundle impact

    | Status | File | Size | Difference (%) |
    | --- | --- | --- | --- |
    | M | src/foo/bar.ts | 120 | +20 (+20%) |

    ",
          "owner": "radashi-org",
          "pull_number": 1,
          "repo": "radashi",
        },
      ],
    ]
  `)
})