import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useStore } from '@/data/store'
import { BurgeeMark } from '@/components/burgee/marks'
import { ROLES } from '@/components/burgee/role-switcher'

const TRY: Record<string, string[]> = {
  director: [
    'Open Week 3 of Opti Race Camp and raise capacity. The waitlist offers spots on its own.',
    'Build groups for a session and drag sailors between coaches.',
    'Change the sibling discount in Settings and watch the price preview move.',
  ],
  coach: [
    'Open today’s Green Team group to see allergies and tap-to-call guardians.',
    'Send a weather call to your group’s parents.',
    'Upload your First Aid renewal before it lapses.',
  ],
  family: [
    'Claim Finn’s waitlist spot before the hold runs out.',
    'Sign Hazel’s medical form and swim test from your phone.',
    'Book summer weeks for both kids and see sibling pricing applied.',
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
      <path d={`M ${pt(0).x} ${pt(0).y} ${Array.from({ length: 40 }, (_, i) => { const p = pt((i + 1) / 40); return `L ${p.x} ${p.y}` }).join(' ')}`} fill='none' stroke='#5b7486' strokeWidth='1.5' />
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

export function Welcome() {
  const navigate = useNavigate()
  const setRole = useStore((s) => s.setRole)
  const clubName = useStore((s) => s.settings.clubName)

  return (
    <div className='min-h-svh bg-sidebar text-sidebar-foreground'>
      <style>{`@keyframes burgee-sway { from { transform: rotate(-2.5deg) } to { transform: rotate(2.5deg) } }`}</style>
      <div className='mx-auto max-w-6xl px-4 pt-6 sm:px-8'>
        <div className='flex items-center gap-3 text-white'>
          <BurgeeMark className='size-9' />
          <span className='font-display text-xl font-bold'>Burgee</span>
          <span className='ms-auto text-sm text-sidebar-foreground'>Demo: {clubName}</span>
        </div>
      </div>
      <div className='mx-auto -mt-2 max-w-6xl px-2'>
        <DressingLine />
      </div>
      <main className='mx-auto max-w-6xl px-4 pb-16 sm:px-8'>
        <h1 className='max-w-[18ch] text-4xl leading-[1.05] font-bold text-white sm:text-6xl'>
          Junior programs, run from one place.
        </h1>
        <p className='mt-5 max-w-[60ch] text-base leading-relaxed sm:text-lg'>
          Registration, waitlists, rosters, coach certifications, waivers and parent messages for yacht club junior
          sailing, swim and tennis. This demo is a made-up club in late October: fall race teams are on the water and
          summer registration opened three weeks ago.
        </p>

        <h2 className='mt-12 mb-4 text-sm font-medium text-white'>Pick a seat</h2>
        <div className='grid gap-4 md:grid-cols-3'>
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => {
                setRole(r.role)
                navigate({ to: r.to })
              }}
              className='group flex flex-col rounded-xl bg-card p-5 text-start text-card-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-sidebar-ring focus-visible:outline-none'
            >
              <span className='flex items-start justify-between gap-2'>
                <span>
                  <span className='block font-display text-xl font-bold'>{r.label}</span>
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
                    <span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-primary' aria-hidden='true' />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <p className='mt-8 text-xs'>
          All names and data are fictional. Changes you make are saved in this browser; reset them any time from the view
          switcher.
        </p>
      </main>
    </div>
  )
}
