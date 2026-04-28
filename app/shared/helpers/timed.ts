export async function timed<T>(
  label: string,
  callback: () => Promise<T>
): Promise<{ label: string; durationMs: number; result: T }> {
  const startedAt = performance.now()
  const result = await callback()

  return {
    label,
    durationMs: Math.round(performance.now() - startedAt),
    result,
  }
}
