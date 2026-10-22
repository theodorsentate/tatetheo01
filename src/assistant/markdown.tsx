import { Fragment, type ReactNode } from 'react'

/**
 * Renders the small Markdown subset the assistant writes — paragraphs,
 * "- " bullets, **bold** and [links](href) — as React elements. No HTML is
 * ever injected. Internal links (starting with "/") go through `onLink` so
 * they navigate inside the app.
 */
export function AnswerText({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let bullets: string[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '), onLink)}</p>)
    para = []
  }
  const flushList = () => {
    if (bullets.length)
      blocks.push(
        <ul key={`u${blocks.length}`} className='list-disc space-y-1 ps-5 marker:text-muted-foreground'>
          {bullets.map((b, i) => (
            <li key={i}>{inline(b, onLink)}</li>
          ))}
        </ul>
      )
    bullets = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (bullet) {
      flushPara()
      bullets.push(bullet[1])
    } else if (!line.trim()) {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line.replace(/^#+\s*/, ''))
    }
  }
  flushPara()
  flushList()
  return <div className='space-y-2.5 text-sm leading-relaxed'>{blocks}</div>
}

const TOKEN = /(\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*|\[([^\]]+)\]\(([^)\s]+)\))/

function inline(text: string, onLink: (href: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let k = 0
  while (rest) {
    const m = rest.match(TOKEN)
    if (!m || m.index === undefined) {
      out.push(rest)
      break
    }
    if (m.index) out.push(rest.slice(0, m.index))
    if (m[2] !== undefined) {
      out.push(<strong key={k++} className='font-semibold'>{inline(m[2], onLink)}</strong>)
    } else {
      const label = m[3]
      const href = m[4]
      if (href.startsWith('/')) {
        out.push(
          <a
            key={k++}
            href={href}
            onClick={(e) => {
              e.preventDefault()
              onLink(href)
            }}
            className='font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary'
          >
            {label}
          </a>
        )
      } else if (/^https?:\/\//.test(href)) {
        out.push(
          <a key={k++} href={href} target='_blank' rel='noreferrer' className='text-primary underline'>
            {label}
          </a>
        )
      } else out.push(<Fragment key={k++}>{label}</Fragment>)
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}
