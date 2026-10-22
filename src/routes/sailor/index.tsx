import { createFileRoute } from '@tanstack/react-router'
import { SailorHome } from '@/features/sailor/sailor'

export const Route = createFileRoute('/sailor/')({ component: SailorHome })
