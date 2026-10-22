import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useStore } from '@/data/store'
import { BurgeeMark } from '@/components/burgee/marks'
import { ROLES } from '@/components/burgee/role-switcher'

const TRY: Record<string, string[]> = {
  director: [
    'Call off today’s practice and text every family in one tap.',
    'See who’s going to the Fall Championship and who needs a chaperone.',
    'Ask Burgee “who still needs their SafeSport?”',
  ],
  coach: [
    'Take attendance for the Green Team, from check-in to pickup.',
    'Open today’s plan and assign boats.',
    'Tick off Hazel’s skills and write her evaluation.',
  ],
  family: [
    'See if practice is on and whether Finn is on the water.',
    'Tell the coaches Hazel is going to the Turkey Bowl.',
    'Read Finn’s evaluation from his coach.',
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
          ['Opti Green Team', 'On'],
          ['Opti Race Team', 'On'],
        ].map(([n, st]) => (
          <li key={n} className='flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-xs'>
            <span className='font-medium text-foreground'>{n}</span>
            <span className='flex gap-1 text-[10px]'>
              <span className='rounded bg-ok-soft px-1.5 py-0.5 font-medium text-ok'>{st}</span>
              <span className='px-1.5 py-0.5 text-muted-foreground'>Delayed</span>
              <span className='px-1.5 py-0.5 text-muted-foreground'>Cancelled</span>
            </span>
          </li>
        ))}
        <li className='rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground'>Fall Championship: 22 going, 3 interested</li>
      </ul>
    )
  }
  if (role === 'family') {
    return (
      <div className='rounded-md border border-ok/30 bg-ok-soft p-2.5 text-xs' aria-hidden='true'>
        <p className='font-display text-sm font-semibold text-ok'>Practice is on</p>
        <p className='mt-0.5 text-foreground'>Opti Race Team, 3:45–6:00 PM</p>
        <p className='mt-2 rounded bg-signal-soft px-2 py-1 font-medium text-signal'>Finn is on the water (since 4:02)</p>
      </div>
    )
  }
  if (role === 'coach') {
    const rows: [string, string, string][] = [
      ['Hazel C.', 'On the water', 'bg-signal-soft text-signal'],
      ['Finn C.', 'Checked in', 'bg-secondary text-secondary-foreground'],
      ['Knox B.', 'Went home', 'bg-ok-soft text-ok'],
    ]
    return (
      <ul className='space-y-1.5' aria-hidden='true'>
        {rows.map(([n, s, c]) => (
          <li key={n} className='flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-xs'>
            <span className='font-medium text-foreground'>{n}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c}`}>{s}</span>
          </li>
        ))}
      </ul>
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
          Practice calls, attendance, lesson plans, skills, regattas, forms and payments, shared by the program director,
          coaches and parents. This demo is a made-up club on a Thursday in late October: two fall teams practice this afternoon.
        </p>

        <h2 className='mt-12 mb-4 text-sm font-medium text-muted-foreground'>Pick a seat</h2>
        <div className='grid gap-5 md:grid-cols-3'>
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
                      {r.role === 'director' ? ', on a laptop' : ', on a phone'}
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
          All names and data are fictional. Changes you make are saved in this browser; reset them any time from the view switcher.
        </p>
      </main>
    </div>
  )
}
