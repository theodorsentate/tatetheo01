import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FORM_TEMPLATES, PROGRAMS } from '@/data/catalog'
import { programById, useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import type { Channel, FormField, FormTemplate } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { now as clockNow } from '@/lib/clock'

type Scope = { kind: 'missing' } | { kind: 'all' } | { kind: 'program'; id: string } | { kind: 'session'; id: string }
const enc = (s: Scope) => JSON.stringify(s)

/**
 * Push a form to families: they get an email/text with a link, it shows up as
 * a to-do in their app with the due date, and the director tracks who signed.
 */
export function SendFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const custom = useStore((s) => s.customTemplates)
  const regs = useStore((s) => s.registrations)
  const sessions = useStore((s) => s.sessions)
  const submissions = useStore((s) => s.submissions)
  const season = useStore((s) => s.settings.season)
  const send = useStore((s) => s.sendFormRequest)
  const look = useLookups()
  const templates = useMemo(() => [...custom, ...FORM_TEMPLATES], [custom])
  const [templateId, setTemplateId] = useState('frostbite-slip')
  const [scope, setScope] = useState<Scope>({ kind: 'missing' })
  const [due, setDue] = useState(format(addDays(clockNow(), 10), 'yyyy-MM-dd'))
  const [channels, setChannels] = useState<Channel[]>(['email', 'sms'])
  const [message, setMessage] = useState('')
  const [building, setBuilding] = useState(false)

  const template = templates.find((t) => t.id === templateId) ?? templates[0]

  const target = useMemo(() => {
    const live = regs.filter((r) => ACTIVE_STATUSES.has(r.status))
    const inScope = live.filter((r) => {
      if (scope.kind === 'program') return look.session.get(r.sessionId)?.programId === scope.id
      if (scope.kind === 'session') return r.sessionId === scope.id
      return true
    })
    let sailorIds = [...new Set(inScope.map((r) => r.sailorId))]
    const signed = (sid: string) => {
      const k = look.sailor.get(sid)!
      return submissions.some(
        (s) => s.templateId === template.id && s.season === season && (template.scope === 'family' ? s.familyId === k.familyId : s.sailorId === sid)
      )
    }
    if (scope.kind === 'missing' || template.custom) sailorIds = sailorIds.filter((sid) => !signed(sid))
    const familyIds = [...new Set(sailorIds.map((sid) => look.sailor.get(sid)!.familyId))]
    const label =
      scope.kind === 'missing'
        ? 'Families who haven’t signed'
        : scope.kind === 'all'
          ? 'All registered families'
          : scope.kind === 'program'
            ? `${programById.get(scope.id)?.name} families`
            : `${programById.get(look.session.get(scope.id)!.programId)?.name}, ${look.session.get(scope.id)!.name} families`
    return { sailorIds, familyIds, label }
  }, [regs, scope, look, submissions, season, template])

  const defaultMessage = `Please sign the ${template.name.toLowerCase()} for your sailor.`

  return (
    <>
      <Dialog open={open && !building} onOpenChange={onOpenChange}>
        <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Send a form to parents</DialogTitle>
            <DialogDescription>
              Families get an email and text with a link. It shows up as a to-do in their app until they sign, and you can see who
              has signed here.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='form-pick'>Form</Label>
              <div className='flex gap-2'>
                <Select value={template.id} onValueChange={setTemplateId}>
                  <SelectTrigger id='form-pick' className='flex-1'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {custom.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>One-off forms</SelectLabel>
                        {custom.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    <SelectGroup>
                      <SelectLabel>Season forms</SelectLabel>
                      {FORM_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button variant='outline' onClick={() => setBuilding(true)}>
                  <Plus className='size-4' /> New form
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>{template.description}</p>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='form-to'>Send to</Label>
              <Select value={enc(scope)} onValueChange={(v) => setScope(JSON.parse(v))}>
                <SelectTrigger id='form-to'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='max-h-80'>
                  <SelectGroup>
                    <SelectItem value={enc({ kind: 'missing' })}>Everyone who hasn’t signed it</SelectItem>
                    <SelectItem value={enc({ kind: 'all' })}>All registered families</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Program</SelectLabel>
                    {PROGRAMS.map((p) => (
                      <SelectItem key={p.id} value={enc({ kind: 'program', id: p.id })}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Single session</SelectLabel>
                    {sessions
                      .filter((s) => s.termId !== 'spring-27')
                      .map((s) => (
                        <SelectItem key={s.id} value={enc({ kind: 'session', id: s.id })}>
                          {programById.get(s.programId)?.name}, {s.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                {target.familyIds.length} families, {target.sailorIds.length} sailors
                {template.custom || scope.kind === 'missing' ? ' who haven’t signed yet' : ''}.
              </p>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='grid gap-1.5'>
                <Label htmlFor='form-due'>Due by</Label>
                <Input id='form-due' type='date' value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
              <fieldset className='grid gap-1.5'>
                <legend className='mb-1.5 text-sm font-medium'>Notify by</legend>
                <div className='flex gap-4 text-sm'>
                  {(['email', 'sms'] as Channel[]).map((c) => (
                    <label key={c} className='flex items-center gap-2'>
                      <Checkbox checked={channels.includes(c)} onCheckedChange={(v) => setChannels(v ? [...channels, c] : channels.filter((x) => x !== c))} />
                      {c === 'email' ? 'Email' : 'Text'}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='form-msg'>Message to parents</Label>
              <Textarea id='form-msg' rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={defaultMessage} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!target.familyIds.length || !channels.length}
              onClick={() => {
                send({
                  templateId: template.id,
                  familyIds: target.familyIds,
                  sailorIds: target.sailorIds,
                  audienceLabel: target.label,
                  dueDate: due || undefined,
                  message: message.trim() || defaultMessage,
                  channels,
                  sentBy: 'Jordan Hale',
                })
                toast.success(`${template.short} sent to ${target.familyIds.length} families`)
                setMessage('')
                onOpenChange(false)
              }}
            >
              <Send className='size-4' /> Send to {target.familyIds.length} families
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FormBuilderDialog
        open={open && building}
        onClose={() => setBuilding(false)}
        onCreated={(t) => {
          setTemplateId(t.id)
          setBuilding(false)
        }}
      />
    </>
  )
}

type Q = { label: string; kind: 'text' | 'yesno' }

/** A one-off form: permission slip, travel release, regatta sign-up. */
function FormBuilderDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: FormTemplate) => void }) {
  const create = useStore((s) => s.createTemplate)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<'sailor' | 'family'>('sailor')
  const [questions, setQuestions] = useState<Q[]>([{ label: '', kind: 'text' }])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>New form</DialogTitle>
          <DialogDescription>For one-off paperwork like a regatta permission slip or travel release. Parents sign with their typed name.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-1.5'>
            <Label htmlFor='fb-name'>Form name</Label>
            <Input id='fb-name' value={name} onChange={(e) => setName(e.target.value)} placeholder='Charleston Race Week travel permission' />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='fb-desc'>One-line summary</Label>
            <Input id='fb-desc' value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Permission to travel with coaches to Race Week, Apr 9–11.' />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='fb-body'>What parents agree to</Label>
            <Textarea id='fb-body' rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder='I give permission for my child to…' />
          </div>
          <fieldset className='grid gap-1.5'>
            <legend className='mb-1.5 text-sm font-medium'>Who signs</legend>
            <div className='flex gap-4 text-sm'>
              <label className='flex items-center gap-2'>
                <input type='radio' checked={scope === 'sailor'} onChange={() => setScope('sailor')} /> One per sailor
              </label>
              <label className='flex items-center gap-2'>
                <input type='radio' checked={scope === 'family'} onChange={() => setScope('family')} /> One per family
              </label>
            </div>
          </fieldset>
          <div className='grid gap-2'>
            <p className='text-sm font-medium'>Questions (optional)</p>
            {questions.map((q, i) => (
              <div key={i} className='flex gap-2'>
                <Input
                  aria-label={`Question ${i + 1}`}
                  value={q.label}
                  onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder='Who is picking up?'
                />
                <Select value={q.kind} onValueChange={(v) => setQuestions(questions.map((x, j) => (j === i ? { ...x, kind: v as Q['kind'] } : x)))}>
                  <SelectTrigger className='w-36' aria-label='Answer type'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='text'>Short answer</SelectItem>
                    <SelectItem value='yesno'>Yes / No</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant='ghost' size='icon' onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label='Remove question'>
                  <Trash2 className='size-4' />
                </Button>
              </div>
            ))}
            {questions.length < 5 && (
              <Button variant='outline' size='sm' className='w-fit' onClick={() => setQuestions([...questions, { label: '', kind: 'text' }])}>
                <Plus className='size-4' /> Add question
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Back
          </Button>
          <Button
            disabled={!name.trim() || !body.trim()}
            onClick={() => {
              const fields: FormField[] = questions
                .filter((q) => q.label.trim())
                .map((q, i) =>
                  q.kind === 'yesno'
                    ? { kind: 'choice', id: `q${i}`, label: q.label.trim(), options: ['Yes', 'No'], required: true }
                    : { kind: 'text', id: `q${i}`, label: q.label.trim(), required: true }
                )
              const t = create({
                name: name.trim(),
                short: name.trim().split(' ').slice(0, 3).join(' '),
                description: description.trim() || name.trim(),
                body: body.trim(),
                scope,
                requiresSignature: true,
                required: false,
                custom: true,
                fields,
              })
              toast.success(`${t.name} created`)
              onCreated(t)
              setName('')
              setDescription('')
              setBody('')
              setQuestions([{ label: '', kind: 'text' }])
            }}
          >
            Create form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
