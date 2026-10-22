/** A minimal iCalendar (.ics) file that Apple, Google and Outlook calendars all import. */
export type IcsEvent = { uid: string; title: string; start: Date; end?: Date; allDay?: boolean; location?: string; description?: string }

const pad = (n: number) => String(n).padStart(2, '0')
const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const day = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export function buildIcs(calName: string, events: IcsEvent[], stamp: Date): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Burgee//Junior Sailing//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(calName)}`]
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@burgee.app`, `DTSTAMP:${local(stamp)}`)
    if (e.allDay) {
      const next = new Date(e.start.getTime() + 86400000)
      lines.push(`DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(e.end ? new Date(e.end.getTime() + 86400000) : next)}`)
    } else {
      lines.push(`DTSTART:${local(e.start)}`, `DTEND:${local(e.end ?? new Date(e.start.getTime() + 3600000))}`)
    }
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** "9:00 AM – 12:00 PM" → hours and minutes for the start and end. */
export function parseTimeRange(text: string): { start: [number, number]; end: [number, number] } | null {
  const m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!m) return null
  const to24 = (h: number, ap?: string) => (ap?.toUpperCase() === 'PM' && h !== 12 ? h + 12 : ap?.toUpperCase() === 'AM' && h === 12 ? 0 : h)
  const endAp = m[6]
  const startAp = m[3] ?? endAp
  return { start: [to24(Number(m[1]), startAp), Number(m[2] ?? 0)], end: [to24(Number(m[4]), endAp), Number(m[5] ?? 0)] }
}
