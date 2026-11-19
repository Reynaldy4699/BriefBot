export type AssistantModeId = 'chat' | 'summarize' | 'support'

export interface AssistantMode {
  id: AssistantModeId
  label: string
  description: string
  systemPrompt: string
  temperature: number
}

export interface SampleAction {
  mode: AssistantModeId
  badge: string
  title: string
  prompt: string
  contextText?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode: AssistantModeId
  attachedTitle?: string
  latencyMs?: number
  modelUsed?: string
  isStreaming?: boolean
  error?: string
}
