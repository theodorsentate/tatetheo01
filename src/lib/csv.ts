/** Parses CSV text (quoted fields, commas and newlines inside quotes) into rows of strings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows.map((r) => r.map((x) => x.trim()))
}

/** Rows as objects keyed by a normalized header ("First name" → "firstname"). */
export function csvObjects(text: string): Record<string, string>[] {
  const [head, ...body] = parseCsv(text)
  if (!head) return []
  const keys = head.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))
}
