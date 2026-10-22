import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { money } from '@/domain/pricing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Stand-in for a Stripe Payment Element. In production this is replaced by
 * Stripe Checkout or Elements (see README → Payments); the surrounding flow
 * and the onPaid callback stay the same.
 */
export function DemoCardForm({
  amount,
  onPaid,
  label,
}: {
  amount: number
  onPaid: () => void
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  if (amount <= 0)
    return (
      <Button className='w-full' size='lg' onClick={onPaid}>
        {label ?? 'Confirm'}
      </Button>
    )
  return (
    <form
      className='grid gap-3'
      onSubmit={(e) => {
        e.preventDefault()
        setBusy(true)
        setTimeout(() => {
          setBusy(false)
          onPaid()
        }, 900)
      }}
    >
      <div className='grid gap-1.5'>
        <Label htmlFor='card'>Card number</Label>
        <Input id='card' inputMode='numeric' autoComplete='off' defaultValue='4242 4242 4242 4242' />
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='exp'>Expires</Label>
          <Input id='exp' autoComplete='off' defaultValue='08 / 29' />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='cvc'>CVC</Label>
          <Input id='cvc' autoComplete='off' defaultValue='123' />
        </div>
      </div>
      <Button type='submit' size='lg' className='mt-1 w-full' disabled={busy}>
        {busy ? <Loader2 className='size-4 animate-spin' /> : <Lock className='size-4' />}
        {busy ? 'Processing…' : (label ?? `Pay ${money(amount)}`)}
      </Button>
      <p className='text-center text-xs text-muted-foreground'>Demo checkout. No card is charged.</p>
    </form>
  )
}
