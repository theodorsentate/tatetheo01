import { createFileRoute } from '@tanstack/react-router'
import { SailorMessages } from '@/features/sailor/sailor'

export const Route = createFileRoute('/sailor/messages')({ component: SailorMessages })
