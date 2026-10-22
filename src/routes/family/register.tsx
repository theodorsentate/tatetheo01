import { createFileRoute } from '@tanstack/react-router'
import { FamilyRegister } from '@/features/family/register'

export const Route = createFileRoute('/family/register')({ component: FamilyRegister })
