import { PERSONAS } from '@/data/catalog'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/burgee/marks'
import { Inbox, useDirectorRecipients } from '@/features/inbox/inbox'

export function AdminInbox() {
  const recipients = useDirectorRecipients()
  return (
    <Main>
      <PageHeader
        title='Inbox'
        description='Questions and replies from families, coaches and sailors. Any conversation with a sailor copies their parents, as SafeSport requires.'
      />
      <Inbox me={{ id: 'director', name: PERSONAS.director.name }} recipients={recipients} layout='desktop' canSeeAll />
    </Main>
  )
}
