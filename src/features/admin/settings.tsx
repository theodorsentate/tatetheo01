import { toast } from 'sonner'
import { useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'

/**
 * Club details, staff rules and the emergency card every coach carries.
 * Pricing and waitlists live in the club's registration system for now.
 */
export function AdminSettings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const e = settings.emergency

  return (
    <Main>
      <PageHeader title='Settings' description='Club details, staff rules and what coaches see on their emergency card.' />
      <div className='grid max-w-4xl gap-6 lg:grid-cols-2'>
        <form
          className='grid content-start gap-4 rounded-lg border bg-card p-4'
          aria-labelledby='club-h'
          onSubmit={(ev) => {
            ev.preventDefault()
            const fd = new FormData(ev.currentTarget)
            updateSettings({
              clubName: String(fd.get('clubName')),
              shortName: String(fd.get('shortName')),
              supportEmail: String(fd.get('supportEmail')),
              certWarningDays: Number(fd.get('warn')) || 45,
            })
            toast.success('Club settings saved')
          }}
        >
          <h2 id='club-h' className='font-semibold'>
            Club and staff rules
          </h2>
          <div className='grid gap-1.5'>
            <Label htmlFor='clubName'>Club name</Label>
            <Input id='clubName' name='clubName' defaultValue={settings.clubName} />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='shortName'>Short name</Label>
              <Input id='shortName' name='shortName' defaultValue={settings.shortName} />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='supportEmail'>Reply-to email for families</Label>
              <Input id='supportEmail' name='supportEmail' type='email' defaultValue={settings.supportEmail} />
            </div>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='warn'>Warn about expiring certifications</Label>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Input id='warn' name='warn' type='number' min={7} max={180} defaultValue={settings.certWarningDays} className='h-9 w-24' />
              days ahead
            </div>
          </div>
          <div>
            <Button type='submit'>Save</Button>
          </div>
        </form>

        <form
          className='grid content-start gap-4 rounded-lg border bg-card p-4'
          aria-labelledby='em-h'
          onSubmit={(ev) => {
            ev.preventDefault()
            const fd = new FormData(ev.currentTarget)
            const v = (k: string) => String(fd.get(k) ?? '').trim()
            updateSettings({ emergency: { address: v('address'), vhf: v('vhf'), hospital: v('hospital'), harbormaster: v('harbormaster') } })
            toast.success('Emergency card updated for every coach')
          }}
        >
          <div>
            <h2 id='em-h' className='font-semibold'>
              Emergency card
            </h2>
            <p className='text-xs text-muted-foreground'>Every coach sees this with their own sailors’ contacts and medical notes.</p>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='address'>Where EMS should come</Label>
            <Input id='address' name='address' defaultValue={e.address} />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='vhf'>Radio channels</Label>
            <Input id='vhf' name='vhf' defaultValue={e.vhf} />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-1.5'>
              <Label htmlFor='hospital'>Nearest hospital</Label>
              <Input id='hospital' name='hospital' defaultValue={e.hospital} />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='harbormaster'>Harbormaster phone</Label>
              <Input id='harbormaster' name='harbormaster' defaultValue={e.harbormaster} />
            </div>
          </div>
          <div>
            <Button type='submit'>Save emergency card</Button>
          </div>
        </form>
      </div>
    </Main>
  )
}
