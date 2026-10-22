import { create } from 'zustand'
import type { Announcement, Audience, Channel } from '@/domain/types'
import type { ToolEvent } from './claude'
import type { AssistantAction } from './query'

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string
      role: 'assistant'
      text: string
      engine: 'claude' | 'local'
      status: 'thinking' | 'streaming' | 'done' | 'error'
      tools: ToolEvent[]
      actions: AssistantAction[]
      note?: string
    }

export type Draft = { title: string; body: string; audience: Audience; channels: Channel[]; category?: Announcement['category'] }

type AskState = {
  open: boolean
  messages: ChatMessage[]
  /** Claude reachable in this view? 'unknown' until checked. */
  claude: 'unknown' | 'available' | 'unavailable'
  /** A question queued from elsewhere (⌘K, the Today page) to ask on open. */
  queued?: string
  /** A message the assistant drafted, picked up by the Messages page. */
  draft?: Draft
  setOpen: (open: boolean) => void
  ask: (question: string) => void
  set: (patch: Partial<AskState>) => void
  update: (id: string, patch: Partial<Extract<ChatMessage, { role: 'assistant' }>>) => void
}

export const useAsk = create<AskState>()((set) => ({
  open: false,
  messages: [],
  claude: 'unknown',
  setOpen: (open) => set({ open }),
  ask: (question) => set({ open: true, queued: question }),
  set: (patch) => set(patch),
  update: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...patch } : m)),
    })),
}))
