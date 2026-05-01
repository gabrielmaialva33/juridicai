type JsonRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
}

export async function jsonRequest<T = unknown>(url: string, options: JsonRequestOptions = {}) {
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')

  const xsrfToken = readCookie('XSRF-TOKEN')
  if (xsrfToken) {
    headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfToken))
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    throw new JsonRequestError(response.status, await errorMessage(response))
  }

  return response.json() as Promise<T>
}

export class JsonRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null
  }

  const prefix = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))

  return cookie?.slice(prefix.length) ?? null
}

async function errorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`

  try {
    const payload = await response.json()
    return payload?.message ?? payload?.code ?? fallback
  } catch {
    return fallback
  }
}
