import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CalendarRange, Laptop, MessageSquareText, Moon, Sun, User, Users } from 'lucide-react'
import { useAsk } from '@/assistant/ask-store'
import { programById } from '@/data/hooks'
import { useStore } from '@/data/store'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FleetChip } from './burgee/marks'
import { adminNav } from './layout/data/sidebar-data'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [query, setQuery] = React.useState('')
  const ask = useAsk((s) => s.ask)
  const sailors = useStore((s) => s.sailors)
  const families = useStore((s) => s.families)
  const sessions = useStore((s) => s.sessions)
  const terms = new Map([
    ['fall-26', 'Fall 2026'],
    ['spring-27', 'Spring 2027'],
    ['summer-27', 'Summer 2027'],
  ])

  const run = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Search, or ask a question…' value={query} onValueChange={setQuery} />
      <CommandList className='max-h-96'>
        {query.trim().split(/\s+/).length >= 2 && (
          <CommandGroup heading='Ask Burgee' forceMount>
            <CommandItem
              forceMount
              value={`ask ${query}`}
              onSelect={() =>
                run(() => {
                  ask(query.trim())
                  setQuery('')
                })
              }
            >
              <MessageSquareText />
              <span className='truncate'>“{query.trim()}”</span>
            </CommandItem>
          </CommandGroup>
        )}
        <CommandEmpty>Nothing matches that. Try a last name or a week number.</CommandEmpty>
        <CommandGroup heading='Go to'>
          {adminNav({ waitlist: 0, certIssues: 0, outstandingForms: 0 })
            .flatMap((g) => g.items)
            .map((item) => (
              <CommandItem
                key={item.title}
                value={`page ${item.title}`}
                onSelect={() => run(() => navigate({ to: item.url as string }))}
              >
                {item.icon && <item.icon />}
                {item.title}
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading='Sailors'>
          {sailors.map((s) => (
            <CommandItem
              key={s.id}
              value={`sailor ${s.firstName} ${s.lastName}`}
              onSelect={() =>
                run(() => navigate({ to: '/admin/families', search: { family: s.familyId } }))
              }
            >
              <User />
              <span className='flex-1'>
                {s.firstName} {s.lastName}
              </span>
              <FleetChip level={s.level} />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading='Families'>
          {families.map((f) => (
            <CommandItem
              key={f.id}
              value={`family ${f.name} ${f.guardians.map((g) => g.name).join(' ')}`}
              onSelect={() => run(() => navigate({ to: '/admin/families', search: { family: f.id } }))}
            >
              <Users />
              {f.name} family
              <span className='ms-auto text-xs text-muted-foreground'>
                {f.membership === 'member' ? f.memberNumber : 'Non-member'}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading='Sessions'>
          {sessions.map((s) => (
            <CommandItem
              key={s.id}
              value={`session ${programById.get(s.programId)?.name} ${s.name} ${terms.get(s.termId)}`}
              onSelect={() => run(() => navigate({ to: '/admin/sessions/$sessionId', params: { sessionId: s.id } }))}
            >
              <CalendarRange />
              {programById.get(s.programId)?.name} · {s.name}
              <span className='ms-auto text-xs text-muted-foreground'>{terms.get(s.termId)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading='Theme'>
          <CommandItem onSelect={() => run(() => setTheme('light'))}>
            <Sun /> Light
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('dark'))}>
            <Moon /> Dark
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('system'))}>
            <Laptop /> System
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
