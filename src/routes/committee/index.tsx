import { createFileRoute } from '@tanstack/react-router'
import { CommitteeReport } from '@/features/committee/report'

export const Route = createFileRoute('/committee/')({ component: CommitteeReport })
