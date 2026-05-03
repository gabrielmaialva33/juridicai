import { test } from '@japa/runner'
import { governmentTimedFetch } from '#modules/integrations/services/government_timed_fetch'

test.group('Government timed fetch', () => {
  test('aborts government source requests after the configured timeout', async ({ assert }) => {
    const fetcher = governmentTimedFetch({
      timeoutMs: 5,
      fetcher: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        }),
    })

    await assert.rejects(() => fetcher('https://example.gov.br/slow-source'), /timed out after 5ms/)
  })
})
