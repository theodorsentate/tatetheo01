import { createFileRoute } from '@tanstack/react-router'
import { FamilyCheckout } from '@/features/family/register'

export const Route = createFileRoute('/family/checkout')({ component: FamilyCheckout })
