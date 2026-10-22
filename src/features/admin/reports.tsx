import { useState } from 'react'
import { format } from 'date-fns'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { saveFile, toCsv } from '@/lib/files'
import { CERT_TYPES } from '@/data/catalog'
import { programById, useLookups } from '@/data/hooks'
import { useStore } from '@/data/store'
import { attendanceRecord, latestSwimCheck, practiceDates } from '@/domain/attendance'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import { ageOn, coachCertRows } from '@/domain/rules'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'
import { ROLE_LABEL } from './staff'

/** Spreadsheet exports. Each builds a CSV from live data and hands it to the browser. */
export function AdminReports() {
  const s = useStore()
  const look = useLookups()
  const [sessionId, setSessionId] = useState('green-team-fall-26')
  const today = format(new Date(), 'yyyy-MM-dd')
  const stamp = format(new Date(), 'yyyy-MM-dd')
  const label = (sid: string) => {
    const se = look.session.get(sid)!
    return `${programById.get(se.programId)?.name}, ${se.name}`
  }
  const medicalFor = (sid: string) => s.submissions.find((x) => x.templateId === 'medical' && x.sailorId === sid && x.season === s.settings.season)

  const download = async (name: string, rows: (string | number | undefined)[][]) => {
    const ok = await saveFile(`${name}-${stamp}.csv`, toCsv(rows), 'text/csv')
    if (ok) toast.success(`${name}.csv ready`)
  }

  const reports: { title: string; body: string; run: () => void; extra?: React.ReactNode }[] = [
    {
      title: 'Session roster',
      body: 'Every confirmed sailor in one session with guardians, phones, allergies, swim check, approved pickups and parent notes. Print it for the coach boat.',
      extra: (
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className='h-9 w-full' aria-label='Session'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='max-h-72'>
            {s.sessions.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {label(x.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
      run: () => {
        const ids = s.registrations.filter((r) => r.sessionId === sessionId && r.status === 'confirmed').map((r) => r.sailorId)
        download(`roster-${sessionId}`, [
          ['Sailor', 'Age', 'Fleet', 'Group', 'Guardian', 'Phone', 'Email', 'Medical alerts', 'Swim check', 'Can also pick up', 'Parent note'],
          ...ids.map((id) => {
            const k = look.sailor.get(id)!
            const f = look.family.get(k.familyId)!
            const g = s.groups.find((x) => x.sessionId === sessionId && x.sailorIds.includes(id))
            const sc = latestSwimCheck(s.swimChecks, id)
            return [`${k.firstName} ${k.lastName}`, ageOn(k.dob, today), k.level, g?.name, f.guardians[0].name, f.guardians[0].phone, f.guardians[0].email, k.medicalAlerts.join('; '), sc ? `${sc.result} ${sc.date}` : 'not done', k.authorizedPickups?.join('; '), k.parentNote?.text]
          }),
        ])
      },
    },
    {
      title: 'Emergency contacts',
      body: 'All registered sailors with every guardian’s phone and the emergency contact from the medical form.',
      run: () => {
        const ids = [...new Set(s.registrations.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))]
        download('emergency-contacts', [
          ['Sailor', 'Guardian 1', 'Phone 1', 'Guardian 2', 'Phone 2', 'Emergency contact', 'Emergency phone', 'Physician'],
          ...ids.map((id) => {
            const k = look.sailor.get(id)!
            const f = look.family.get(k.familyId)!
            const m = medicalFor(id)
            return [`${k.firstName} ${k.lastName}`, f.guardians[0]?.name, f.guardians[0]?.phone, f.guardians[1]?.name, f.guardians[1]?.phone, m?.values.emergencyName, m?.values.emergencyPhone, m?.values.physician]
          }),
        ])
      },
    },
    {
      title: 'Medical alerts',
      body: 'Sailors with allergies, medications or conditions on file, for the first aid kit binder.',
      run: () =>
        download('medical-alerts', [
          ['Sailor', 'Alerts', 'Allergies', 'Medications', 'Conditions', 'Guardian phone'],
          ...s.sailors
            .filter((k) => k.medicalAlerts.length)
            .map((k) => {
              const m = medicalFor(k.id)
              return [`${k.firstName} ${k.lastName}`, k.medicalAlerts.join('; '), m?.values.allergies, m?.values.medications, m?.values.conditions, look.family.get(k.familyId)!.guardians[0].phone]
            }),
        ]),
    },
    {
      title: 'Season attendance',
      body: 'Practices attended and missed for every sailor on a team this fall.',
      run: () => {
        const all = Object.values(s.attendance)
        const rows: (string | number | undefined)[][] = [['Sailor', 'Team', 'Attended', 'Missed', 'Rate']]
        for (const se of s.sessions.filter((x) => x.termId === 'fall-26')) {
          const dates = practiceDates(se, new Date()).filter((d) => d < today)
          for (const r of s.registrations.filter((x) => x.sessionId === se.id && x.status === 'confirmed')) {
            const k = look.sailor.get(r.sailorId)!
            const rec = attendanceRecord(all, k.id, se.id, dates)
            rows.push([`${k.firstName} ${k.lastName}`, programById.get(se.programId)?.name, rec.attended, rec.missed, rec.rate === undefined ? '' : `${Math.round(rec.rate * 100)}%`])
          }
        }
        download('season-attendance', rows)
      },
    },
    {
      title: 'Staff certifications',
      body: 'Every staff member’s required certifications with status and expiry dates. Insurers often ask for this.',
      run: () =>
        download('staff-certifications', [
          ['Staff', 'Role', 'Certification', 'Status', 'Expires'],
          ...s.coaches.flatMap((c) => coachCertRows(c, CERT_TYPES, new Date(), s.settings.certWarningDays).map((r) => [c.name, ROLE_LABEL[c.role], r.certType.name, r.status, r.expires])),
        ]),
    },
    {
      title: 'Staff directory',
      body: 'Names, roles, phones, emails and emergency contacts for the whole staff.',
      run: () =>
        download('staff-directory', [
          ['Name', 'Role', 'Phone', 'Email', 'Emergency contact', 'Emergency phone'],
          ...s.coaches.map((c) => [c.name, ROLE_LABEL[c.role], c.phone, c.email, c.emergencyContact?.name, c.emergencyContact?.phone]),
        ]),
    },
    {
      title: 'Registrations & payments',
      body: 'Every registration with status, price and amount paid, for the club treasurer.',
      run: () =>
        download('registrations', [
          ['Sailor', 'Family', 'Session', 'Status', 'Registered', 'Price', 'Paid'],
          ...s.registrations.map((r) => {
            const k = look.sailor.get(r.sailorId)!
            return [`${k.firstName} ${k.lastName}`, look.family.get(k.familyId)?.name, label(r.sessionId), r.status, r.createdAt.slice(0, 10), r.price, r.paid]
          }),
        ]),
    },
  ]

  return (
    <Main>
      <PageHeader title='Reports' description='Spreadsheets you can open in Excel or Google Sheets. Each one is built from live data the moment you download it.' />
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {reports.map((r) => (
          <section key={r.title} className='flex flex-col rounded-lg border bg-card p-5'>
            <h2 className='font-semibold'>{r.title}</h2>
            <p className='mt-1 flex-1 text-sm text-muted-foreground'>{r.body}</p>
            {r.extra && <div className='mt-3'>{r.extra}</div>}
            <Button variant='outline' className='mt-4 w-fit' onClick={r.run}>
              <Download className='size-4' /> Download CSV
            </Button>
          </section>
        ))}
      </div>
    </Main>
  )
}
