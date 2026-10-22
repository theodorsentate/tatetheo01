import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useStore } from '@/data/store'
import { BurgeeMark } from '@/components/burgee/marks'
import { ROLES } from '@/components/burgee/role-switcher'

const TRY: Record<string, string[]> = {
  director: [
    'Call the afternoon groups in for lightning and text every family in one tap.',
    'Approve coach evaluations before families see them.',
    'Answer a parent in the inbox, or ask Burgee “who still needs their SafeSport?”',
  ],
  coach: [
    'Check in Green A and launch them, with swim checks built in.',
    'See which kids are out today and who is picking up whom.',
    'Open the emergency card for your group.',
  ],
  family: [
    'See that Hazel is on the water, and who’s in her group.',
    'Tell the coaches Grandma is picking up today, in two taps.',
    'Message Hazel’s coach about the Harbor Island regatta.',
  ],
  sailor: [
    'See today’s plan and your coach’s evaluation.',
    'Message your coach. Your parents are copied automatically.',
    'Track your skills toward the next level.',
  ],
  committee: [
    'The season at a glance: sailors, attendance, safety.',
    'No names, phone numbers or medical details.',
    'Everything Burgee handled for families this summer.',
  ],
}

/** Fleet pennants on a dressing line — the club flags strung up for regatta day. */
function DressingLine() {
  const colors = ['#0ea5e9', '#16a34a', '#dc2626', '#ffffff', '#2563eb', '#7c3aed', '#ea580c', '#c8342b', '#16a34a', '#2563eb', '#ffffff', '#dc2626', '#0ea5e9', '#7c3aed']
  const n = colors.length
  const pt = (t: number) => {
    // gentle catenary from top-left to top-right
    const x = 20 + t * 1160
    const y = 30 + Math.sin(t * Math.PI) * 70
    return { x, y }
  }
  return (
    <svg viewBox='0 0 1200 150' className='h-auto w-full' aria-hidden='true' preserveAspectRatio='none'>
      <path d={`M ${pt(0).x} ${pt(0).y} ${Array.from({ length: 40 }, (_, i) => { const p = pt((i + 1) / 40); return `L ${p.x} ${p.y}` }).join(' ')}`} fill='none' stroke='#8aa0b8' strokeWidth='1.5' />
      {colors.map((c, i) => {
        const t = (i + 0.5) / n
        const a = pt(t - 0.025)
        const b = pt(t + 0.025)
        const tip = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 46 }
        return (
          <path
            key={i}
            d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${tip.x} ${tip.y} Z`}
            fill={c}
            stroke={c === '#ffffff' ? '#94a3b8' : c}
            strokeWidth='1'
            style={{ transformOrigin: `${(a.x + b.x) / 2}px ${a.y}px`, animation: `burgee-sway ${3 + (i % 4) * 0.4}s ease-in-out ${i * 0.12}s infinite alternate` }}
          />
        )
      })}
    </svg>
  )
}

/** Small product glimpses so each door shows what's behind it. */
function Glimpse({ role }: { role: string }) {
  if (role === 'director') {
    return (
      <ul className='space-y-1.5' aria-hidden='true'>
        {[
          ['Opti Green Camp', 'On', 'AM'],
          ['Opti Race Camp', 'On', 'PM'],
        ].map(([n, st, slot]) => (
          <li key={n} className='flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-xs'>
            <span className='font-medium text-foreground'>
              {n} <span className='font-normal text-muted-foreground'>{slot}</span>
            </span>
            <span className='flex gap-1 text-[10px]'>
              <span className='rounded bg-ok-soft px-1.5 py-0.5 font-medium text-ok'>{st}</span>
              <span className='px-1.5 py-0.5 text-muted-foreground'>Delayed</span>
              <span className='px-1.5 py-0.5 text-muted-foreground'>Cancelled</span>
            </span>
          </li>
        ))}
        <li className='rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground'>6 evaluations waiting for your approval</li>
      </ul>
    )
  }
  if (role === 'family') {
    return (
      <div className='rounded-md border border-ok/30 bg-ok-soft p-2.5 text-xs' aria-hidden='true'>
        <p className='font-display text-sm font-semibold text-ok'>Practice is on</p>
        <p className='mt-0.5 text-foreground'>Opti Green Camp, 9:00 AM – 12:00 PM</p>
        <p className='mt-2 rounded bg-signal-soft px-2 py-1 font-medium text-signal'>Hazel is on the water (since 9:38)</p>
      </div>
    )
  }
  if (role === 'coach') {
    const rows: [string, string, string][] = [
      ['Hazel C.', 'On the water', 'bg-signal-soft text-signal'],
      ['Wren D.', 'Out today (parent)', 'bg-muted text-muted-foreground'],
      ['Ava H.', 'Checked in', 'bg-secondary text-secondary-foreground'],
    ]
    return (
      <ul className='space-y-1.5' aria-hidden='true'>
        {rows.map(([n, st, c]) => (
          <li key={n} className='flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-xs'>
            <span className='font-medium text-foreground'>{n}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c}`}>{st}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (role === 'sailor') {
    return (
      <div className='rounded-md border border-border bg-card p-2.5 text-xs' aria-hidden='true'>
        <p className='text-muted-foreground'>Today’s plan</p>
        <p className='font-medium text-foreground'>Camp afternoon: speed and shifts</p>
        <p className='mt-2 rounded bg-ok-soft px-2 py-1 text-ok'>Parents copied on coach messages</p>
      </div>
    )
  }
  if (role === 'committee') {
    return (
      <dl className='grid grid-cols-3 gap-1.5 text-center text-xs' aria-hidden='true'>
        {[
          ['Sailors', '190'],
          ['Attendance', '94%'],
          ['Staff certified', '12/14'],
        ].map(([l, v]) => (
          <div key={l} className='rounded-md border border-border bg-card px-1 py-1.5'>
            <dd className='font-display text-base font-semibold text-heading'>{v}</dd>
            <dt className='text-[10px] text-muted-foreground'>{l}</dt>
          </div>
        ))}
      </dl>
    )
  }
  return null
}

export function Welcome() {
  const navigate = useNavigate()
  const setRole = useStore((s) => s.setRole)
  const clubName = useStore((s) => s.settings.clubName)

  return (
    <div className='min-h-svh bg-card text-foreground'>
      <style>{`@keyframes burgee-sway { from { transform: rotate(-2.5deg) } to { transform: rotate(2.5deg) } }`}</style>
      <div className='bg-gradient-to-b from-accent/70 to-card'>
        <div className='mx-auto max-w-6xl px-4 pt-6 sm:px-8'>
          <div className='flex items-center gap-3'>
            <BurgeeMark className='size-9 text-heading' />
            <span className='font-display text-xl font-semibold text-heading'>Burgee</span>
            <span className='ms-auto text-sm text-muted-foreground'>Demo club: {clubName}</span>
          </div>
        </div>
        <div className='mx-auto -mt-2 max-w-6xl px-2'>
          <DressingLine />
        </div>
      </div>
      <main className='mx-auto max-w-6xl px-4 pb-16 sm:px-8'>
        <h1 className='max-w-[18ch] text-4xl leading-[1.05] font-semibold sm:text-6xl'>Your junior sailing program, in one place.</h1>
        <p className='mt-5 max-w-[60ch] text-base leading-relaxed text-muted-foreground sm:text-lg'>
          Practice calls, attendance, lesson plans, skills, messages, regattas and forms, shared by the program director,
          coaches, parents and older sailors. This demo is a made-up club on a Wednesday in July, week 5 of summer camp,
          with the morning groups on the water.
        </p>

        <h2 className='mt-12 mb-4 text-sm font-medium text-muted-foreground'>Pick a seat</h2>
        <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => {
                setRole(r.role)
                navigate({ to: r.to })
              }}
              className='group flex flex-col overflow-hidden rounded-xl border bg-card text-start shadow-[var(--shadow-card)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none'
            >
              <div className='border-b bg-muted/60 p-4'>
                <Glimpse role={r.role} />
              </div>
              <div className='flex flex-1 flex-col p-5'>
                <span className='flex items-start justify-between gap-2'>
                  <span>
                    <span className='block font-display text-xl font-semibold text-heading'>{r.label}</span>
                    <span className='text-sm text-muted-foreground'>
                      as {r.who}
                      {r.role === 'director' || r.role === 'committee' ? ', on a laptop' : ', on a phone'}
                    </span>
                  </span>
                  <ArrowUpRight className='size-5 text-muted-foreground transition-colors group-hover:text-primary' />
                </span>
                <ul className='mt-4 space-y-2 border-t pt-4 text-sm'>
                  {TRY[r.role].map((t) => (
                    <li key={t} className='flex gap-2'>
                      <span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-brass' aria-hidden='true' />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          ))}
        </div>
        <p className='mt-8 text-xs text-muted-foreground'>
          All names and data are fictional. Changes you make are saved in this browser. The view switcher can reset them, or jump to the afternoon when the PM groups sail.
        </p>
      </main>
    </div>
  )
}
