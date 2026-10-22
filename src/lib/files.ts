/**
 * Saving and reading files in a way that works in every place the demo runs:
 * inside a Claude viewer (through its `downloads` capability, which asks the
 * viewer to confirm), or as a normal web page / local file (a plain download).
 */

type SaveFn = (req: { filename: string; data: string | Blob }) => Promise<{ status: string }>

let downloadsPromise: Promise<{ save: SaveFn } | null> | null = null
function getDownloads() {
  if (downloadsPromise) return downloadsPromise
  const runtime = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude
  downloadsPromise = runtime?.use
    ? runtime.use('downloads').then((d) => (d ? (d as { save: SaveFn }) : null)).catch(() => null)
    : Promise.resolve(null)
  return downloadsPromise
}

/** Resolves true when the file was handed over, false if declined or unavailable. */
export async function saveFile(filename: string, data: string | Blob, mime = 'text/plain'): Promise<boolean> {
  const dl = await getDownloads()
  if (dl) {
    try {
      await dl.save({ filename, data })
      return true
    } catch {
      return false
    }
  }
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch {
    return false
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Files up to this size are kept in the demo so they can be viewed later. */
export const KEEP_LIMIT = 1_500_000

export function readFile(file: File): Promise<{ fileName: string; mime: string; sizeBytes: number; dataUrl?: string }> {
  return new Promise((resolve) => {
    const base = { fileName: file.name, mime: file.type || 'application/octet-stream', sizeBytes: file.size }
    if (file.size > KEEP_LIMIT) return resolve(base)
    const r = new FileReader()
    r.onload = () => resolve({ ...base, dataUrl: String(r.result) })
    r.onerror = () => resolve(base)
    r.readAsDataURL(file)
  })
}

export const fileSize = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)

/** Rows → CSV text (RFC 4180 quoting). */
export function toCsv(rows: (string | number | undefined | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === undefined || v === null ? '' : String(v)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(',')
    )
    .join('\n')
}
