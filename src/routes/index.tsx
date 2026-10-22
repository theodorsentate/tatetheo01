import { createFileRoute } from '@tanstack/react-router'
import { Welcome } from '@/features/welcome'

export const Route = createFileRoute('/')({ component: Welcome })
