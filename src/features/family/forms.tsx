import { useState } from 'react'
import { format } from 'date-fns'
import { Check, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import type { FormTemplate, Sailor } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useAllTemplates, useFamily, useFamilyPending } from './home'

export function FamilyForms() {
  const { family } = useFamily()
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const templates = useAllTemplates()
  const pending = useFamilyPending()
  const [signing, setSigning] = useState<{ t: FormTemplate; sailor?: Sailor } | null>(null)
  const look = useLookups()

  const find = (t: FormTemplate, sailor?: Sailor) =>
    submissions.find(
      (s) => s.templateId === t.id && s.season === season && s.familyId === family.id && (t.scope === 'family' || s.sailorId === sailor?.id)
    )

  const todo = pending.map((p) => ({ t: p.template, sailor: p.sailor, dueDate: p.dueDate }))
  const doneRows = submissions
    .filter((s) => s.familyId === family.id && s.season === season)
    .map((s) => ({ t: templates.find((t) => t.id === s.templateId)!, sailor: s.sailorId ? look.sailor.get(s.sailorId) : undefined }))
    .filter((r) => r.t)

  return (
    <div className='px-4 py-5'>
      <h1 className='text-2xl font-semibold'>Forms</h1>
      <p className='text-sm text-muted-foreground'>
        Season forms are signed once for {season}. The club may also send one-off forms, like regatta permission slips.
      </p>
      {todo.length > 0 && (
        <section className='mt-5'>
          <h2 className='mb-2 text-sm font-semibold text-muted-foreground'>To sign</h2>
          <ul className='space-y-2'>
            {todo.map(({ t, sailor, dueDate }) => (
              <li key={t.id + (sailor?.id ?? '')}>
                <button onClick={() => setSigning({ t, sailor })} className='flex w-full items-center gap-3 rounded-lg border border-signal/40 bg-card p-4 text-start'>
                  <span className='min-w-0 flex-1'>
                    <span className='block font-medium'>{t.name}</span>
                    <span className='block text-sm text-muted-foreground'>
                      {sailor ? `For ${sailor.firstName}` : 'For the whole family'}
                      {dueDate && <span className='font-medium text-signal'>, due {format(new Date(`${dueDate}T12:00:00`), 'MMM d')}</span>}
                    </span>
                  </span>
                  <ChevronRight className='size-4 text-muted-foreground' />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className='mt-6'>
        <h2 className='mb-2 text-sm font-semibold text-muted-foreground'>Signed</h2>
        <ul className='divide-y rounded-lg border bg-card'>
          {doneRows.map(({ t, sailor }) => {
            const sub = find(t, sailor)!
            return (
              <li key={t.id + (sailor?.id ?? '')} className='flex items-center gap-3 px-4 py-3'>
                <Check className='size-4 text-ok' />
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium'>
                    {t.short}
                    {sailor ? `, ${sailor.firstName}` : ''}
                  </span>
                  <span className='block text-xs text-muted-foreground'>
                    {sub.signedBy}, {format(new Date(sub.signedAt), 'MMM d')}
                  </span>
                </span>
                <Button variant='ghost' size='sm' onClick={() => setSigning({ t, sailor })}>
                  Update
                </Button>
              </li>
            )
          })}
          {doneRows.length === 0 && <li className='px-4 py-3 text-sm text-muted-foreground'>Nothing signed yet.</li>}
        </ul>
      </section>

      <Sheet open={!!signing} onOpenChange={(o) => !o && setSigning(null)}>
        <SheetContent side='bottom' className='max-h-[92svh] overflow-y-auto rounded-t-2xl'>
          {signing && (
            <SignForm
              key={signing.t.id + (signing.sailor?.id ?? '')}
              template={signing.t}
              sailor={signing.sailor}
              initial={find(signing.t, signing.sailor)?.values}
              onDone={() => setSigning(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SignForm({
  template: t,
  sailor,
  initial,
  onDone,
}: {
  template: FormTemplate
  sailor?: Sailor
  initial?: Record<string, string>
  onDone: () => void
}) {
  const { family } = useFamily()
  const submit = useStore((s) => s.submitForm)
  const updateSailor = useStore((s) => s.updateSailor)
  const season = useStore((s) => s.settings.season)
  const [values, setValues] = useState<Record<string, string>>(initial ?? {})
  const [signature, setSignature] = useState('')
  const [agree, setAgree] = useState(false)
  const guardian = family.guardians[0]
  const missing = t.fields.filter((f) => f.required && !values[f.id]?.trim())

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (missing.length) return toast.error(`Fill in: ${missing.map((m) => m.label).join(', ')}`)
        if (!agree || signature.trim().length < 3) return toast.error('Type your full name and tick the box to sign.')
        submit({ templateId: t.id, familyId: family.id, sailorId: sailor?.id, season, signedBy: signature.trim(), values })
        if (t.id === 'medical' && sailor) {
          const alerts = [values.allergies, values.conditions]
            .filter((v) => v && !/^none$/i.test(v.trim()))
            .map((v) => v!.trim())
          if (alerts.length) updateSailor(sailor.id, { medicalAlerts: alerts })
        }
        toast.success(`${t.short} signed${sailor ? ` for ${sailor.firstName}` : ''}`)
        onDone()
      }}
    >
      <SheetHeader>
        <SheetTitle>{t.name}</SheetTitle>
        <SheetDescription>{sailor ? `For ${sailor.firstName} ${sailor.lastName}, ${season}` : `For the ${family.name} family, ${season}`}</SheetDescription>
      </SheetHeader>
      <div className='grid gap-4 px-4 pb-6'>
        {t.fields.map((f) => (
          <div key={f.id} className='grid gap-1.5'>
            <Label htmlFor={f.id}>
              {f.label}
              {f.required && <span className='text-destructive'> *</span>}
            </Label>
            {f.kind === 'textarea' ? (
              <Textarea id={f.id} rows={2} value={values[f.id] ?? ''} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} placeholder='None' />
            ) : f.kind === 'choice' ? (
              <RadioGroup value={values[f.id]} onValueChange={(v) => setValues({ ...values, [f.id]: v })} id={f.id}>
                {f.options.map((o) => (
                  <label key={o} className='flex items-center gap-2 rounded-md border p-3 text-sm'>
                    <RadioGroupItem value={o} /> {o}
                  </label>
                ))}
              </RadioGroup>
            ) : (
              <Input id={f.id} type={f.kind === 'date' ? 'date' : 'text'} value={values[f.id] ?? ''} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />
            )}
          </div>
        ))}
        <p className='rounded-md bg-muted p-3 text-sm leading-relaxed text-muted-foreground'>{t.body}</p>
        <div className='grid gap-1.5'>
          <Label htmlFor='sig'>Type your full name to sign</Label>
          <Input id='sig' value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={guardian.name} className='font-display text-lg italic' autoComplete='name' />
        </div>
        <label className='flex items-start gap-2 text-sm'>
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className='mt-0.5' />
          I am {sailor ? `${sailor.firstName}’s` : 'a'} parent or legal guardian and I agree to the above.
        </label>
        <Button type='submit' size='lg'>
          Sign {t.short.toLowerCase()}
        </Button>
      </div>
    </form>
  )
}
