import { useLocation, useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown, ClipboardList, Landmark, LifeBuoy, RotateCcw, Sailboat, Sun, Sunset, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useStore, type Role } from '@/data/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const ROLES: { role: Role; label: string; who: string; to: '/admin' | '/coach' | '/family' | '/sailor' | '/committee'; icon: typeof Users }[] = [
  { role: 'director', label: 'Program director', who: 'Jordan Hale', to: '/admin', icon: ClipboardList },
  { role: 'coach', label: 'Coach', who: 'Maya Ortiz', to: '/coach', icon: LifeBuoy },
  { role: 'family', label: 'Parent', who: 'Sarah Calloway', to: '/family', icon: Users },
  { role: 'sailor', label: 'Sailor', who: 'Lucy Reyes, 15, Club 420', to: '/sailor', icon: Sailboat },
  { role: 'committee', label: 'Junior committee', who: 'Anne Whitmore, read-only', to: '/committee', icon: Landmark },
]

export function RoleSwitcher({
  className,
  variant = 'light',
}: {
  className?: string
  variant?: 'light' | 'dark'
}) {
  const path = useLocation({ select: (l) => l.pathname })
  const role = path.startsWith('/coach')
    ? 'coach'
    : path.startsWith('/family')
      ? 'family'
      : path.startsWith('/sailor')
        ? 'sailor'
        : path.startsWith('/committee')
          ? 'committee'
          : 'director'
  const setRole = useStore((s) => s.setRole)
  const reset = useStore((s) => s.resetDemo)
  const setTime = useStore((s) => s.setDemoTime)
  const navigate = useNavigate()
  const current = ROLES.find((r) => r.role === role) ?? ROLES[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className={cn(
            'h-auto justify-between gap-2 px-2 py-1.5 text-start',
            variant === 'dark' && 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            className
          )}
        >
          <span className='grid leading-tight'>
            <span className='text-[11px] opacity-70'>Demo view</span>
            <span className='text-sm font-semibold'>{current.label}</span>
          </span>
          <ChevronsUpDown className='size-4 opacity-60' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-64'>
        <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
          See Burgee as…
        </DropdownMenuLabel>
        {ROLES.map((r) => (
          <DropdownMenuItem
            key={r.role}
            onClick={() => {
              setRole(r.role)
              navigate({ to: r.to })
            }}
            className='gap-3'
          >
            <r.icon className='size-4' />
            <span className='grid leading-tight'>
              <span className='font-medium'>{r.label}</span>
              <span className='text-xs text-muted-foreground'>{r.who}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Jump to</DropdownMenuLabel>
        {(
          [
            ['morning', 'Morning', 'AM groups on the water', Sun],
            ['afternoon', 'Afternoon', 'PM groups on the water', Sunset],
          ] as const
        ).map(([t, label, hint, Icon]) => (
          <DropdownMenuItem
            key={t}
            className='gap-3'
            onClick={() => {
              setTime(t)
              toast.success(`It’s now ${label.toLowerCase()} on camp day. Demo data rebuilt.`)
            }}
          >
            <Icon className='size-4' />
            <span className='grid leading-tight'>
              <span className='font-medium'>{label}</span>
              <span className='text-xs text-muted-foreground'>{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            reset()
            toast.success('Demo data reset')
          }}
          className='gap-3'
        >
          <RotateCcw className='size-4' />
          Reset demo data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
