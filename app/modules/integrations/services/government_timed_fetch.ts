const DEFAULT_TIMEOUT_MS = 30_000

type GovernmentTimedFetchOptions = {
  timeoutMs?: number | null
  fetcher?: typeof fetch
}

export function governmentTimedFetch(options: GovernmentTimedFetchOptions = {}): typeof fetch {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs)
  const baseFetch = options.fetcher ?? fetch

  return async (input, init = {}) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal

    try {
      return await baseFetch(input, {
        ...init,
        signal,
      })
    } catch (error) {
      if (timeoutSignal.aborted) {
        throw new Error(
          `Government source request timed out after ${timeoutMs}ms for ${requestLabel(input)}.`
        )
      }

      throw error
    }
  }
}

function normalizeTimeoutMs(value: number | null | undefined) {
  if (!value || value <= 0) {
    return DEFAULT_TIMEOUT_MS
  }

  return Math.trunc(value)
}

function requestLabel(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}
