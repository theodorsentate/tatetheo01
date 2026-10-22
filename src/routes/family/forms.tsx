import { createFileRoute } from '@tanstack/react-router'
import { FamilyForms } from '@/features/family/forms'

export const Route = createFileRoute('/family/forms')({ component: FamilyForms })
