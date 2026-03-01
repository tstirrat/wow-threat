/**
 * Events Route Logging Utilities
 *
 * Shared runtime timing, payload-size estimation, and optional memory checkpoint logging.
 */
const payloadEstimateSampleSize = 200
const textEncoder = new TextEncoder()

interface ProcessMemoryUsageSnapshot {
  heapUsed?: number
  rss?: number
}

interface ProcessWithMemoryUsage {
  memoryUsage: () => ProcessMemoryUsageSnapshot
}

interface PerformanceMemorySnapshot {
  usedJSHeapSize?: number
}

interface PerformanceWithMemory {
  memory?: PerformanceMemorySnapshot
}

interface RuntimeMemorySnapshot {
  heapUsedBytes?: number
  rssBytes?: number
  source: 'process' | 'performance' | 'unavailable'
}

/** Return a monotonic timer when available, with `Date.now()` fallback. */
export function monotonicNowMs(): number {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now()
  }

  return Date.now()
}

/** Measure UTF-8 encoded size for serialized response payloads. */
export function getUtf8ByteLength(value: string): number {
  return textEncoder.encode(value).length
}

/** Estimate serialized bytes for large arrays by sampling a subset. */
export function estimateArrayPayloadBytes<T>(items: readonly T[]): number {
  if (items.length === 0) {
    return 2
  }

  const sampleCount = Math.min(items.length, payloadEstimateSampleSize)
  const sampleBytes = items
    .slice(0, sampleCount)
    .reduce(
      (totalBytes, item) =>
        totalBytes + getUtf8ByteLength(JSON.stringify(item)),
      0,
    )
  const averageBytesPerItem = sampleBytes / sampleCount

  return Math.round(averageBytesPerItem * items.length)
}

function readRuntimeMemorySnapshot(): RuntimeMemorySnapshot {
  const processWithMemory = (
    globalThis as typeof globalThis & {
      process?: ProcessWithMemoryUsage
    }
  ).process
  if (typeof processWithMemory?.memoryUsage === 'function') {
    const usage = processWithMemory.memoryUsage()
    return {
      heapUsedBytes:
        typeof usage.heapUsed === 'number' ? usage.heapUsed : undefined,
      rssBytes: typeof usage.rss === 'number' ? usage.rss : undefined,
      source: 'process',
    }
  }

  const performanceWithMemory = globalThis.performance as
    | (Performance & PerformanceWithMemory)
    | undefined
  if (typeof performanceWithMemory?.memory?.usedJSHeapSize === 'number') {
    return {
      heapUsedBytes: performanceWithMemory.memory.usedJSHeapSize,
      source: 'performance',
    }
  }

  return {
    source: 'unavailable',
  }
}

function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined) {
    return undefined
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Emit optional memory checkpoints for large event responses. */
export function logEventsMemoryCheckpoint({
  code,
  debugMemory,
  details,
  fightId,
  phase,
}: {
  code: string
  fightId: number
  phase: string
  debugMemory: boolean
  details: Record<string, number | string | boolean | undefined>
}): void {
  if (!debugMemory) {
    return
  }

  const snapshot = readRuntimeMemorySnapshot()
  console.info('[Events] Memory checkpoint', {
    code,
    fightId,
    phase,
    memorySource: snapshot.source,
    heapUsed: formatBytes(snapshot.heapUsedBytes),
    heapUsedBytes: snapshot.heapUsedBytes,
    rss: formatBytes(snapshot.rssBytes),
    rssBytes: snapshot.rssBytes,
    ...details,
  })
}
