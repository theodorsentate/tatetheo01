import { createFileRoute } from '@tanstack/react-router'
import { CoachCerts } from '@/features/coach/coach'

export const Route = createFileRoute('/coach/certs')({ component: CoachCerts })
