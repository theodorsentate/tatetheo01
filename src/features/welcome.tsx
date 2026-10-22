import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useStore } from '@/data/store'
import { BurgeeMark } from '@/components/burgee/marks'
import { ROLES } from '@/components/burgee/role-switcher'

const TRY: Record<string, string[]> = {
  director: [
    'Ask Burgee “who still needs their SafeSport?”',
    'Send a regatta permission slip to every Green Team family.',
    'Raise a full week’s capacity and watch the waitlist offer spots.',
  ],
  coach: [
    'Take attendance for today’s Green Team: check in, launch, everyone ashore.',
    'Run a swim check before a sailor can launch.',
    'Sign a sailor out to an approved pickup.',
  ],
  family: [
    'Claim Finn’s waitlist spot before the hold runs out.',
    'Sign the permission slip the club just sent.',
    'Leave a note for Hazel’s coaches and add Grandma as a pickup.',
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
    const fills = [
      [0.3, 0.5, 1, 1, 0.6, 0.4],
      [0.2, 0.4, 1, 1, 0.5, 0.3],
      [0.4, 0.6, 1, 0.9, 1, 0.5],
    ]
    return (
      <div className='grid grid-cols-6 gap-1' aria-hidden='true'>
        {fills.flatMap((row, r) =>
          row.map((f, c) => (
            <div key={`${r}${c}`} className='relative h-7 overflow-hidden rounded-[4px] border border-border bg-card'>
              <div className='absolute inset-x-0 bottom-0 bg-primary/15' style={{ height: `${f * 100}%` }} />
              {f === 1 && (r + c) % 2 === 0 && <span className='absolute end-1 top-1 size-1.5 rounded-full bg-signal' />}
            </div>
          ))
        )}
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
  return (
    <div className='rounded-md border border-signal/40 bg-signal-soft p-2.5 text-xs' aria-hidden='true'>
      <p className='font-semibold text-signal'>Spot opened, 30h left</p>
      <p className='mt-0.5 text-foreground'>Finn got off the waitlist for Race Camp, Week 5</p>
      <div className='mt-2 h-6 rounded bg-primary' />
    </div>
  )
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
        <h1 className='max-w-[18ch] text-4xl leading-[1.05] font-semibold sm:text-6xl'>Junior programs, run from one place.</h1>
        <p className='mt-5 max-w-[60ch] text-base leading-relaxed text-muted-foreground sm:text-lg'>
          Registration, waitlists, rosters, attendance, coach certifications, waivers and parent messages for yacht club junior
          sailing, swim and tennis. This demo is a made-up club in late October: fall race teams are on the water and summer
          registration opened three weeks ago.
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
