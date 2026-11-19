import type { AssistantMode, SampleAction } from '../types'

export const ASSISTANT_MODES: AssistantMode[] = [
  {
    id: 'chat',
    label: 'Quick Chat',
    description: 'Clear, direct answers for everyday questions and technical topics.',
    temperature: 0.4,
    systemPrompt: `You are BriefBot, a friendly, minimalist AI assistant.
Give clear, concise, practical answers.
Formatting rule: Never use asterisk (*) characters anywhere in your response. Use '-' for bullet lists and '###' for section headings.`,
  },
  {
    id: 'summarize',
    label: 'Summarize Text',
    description: 'Turns long notes, emails, or docs into a crisp TL;DR and action items.',
    temperature: 0.2,
    systemPrompt: `You are BriefBot in Summarizer mode.
When given text or a document, output:
### Summary
A 2-sentence TL;DR.
### Key Takeaways
- Up to 4 concise bullet points using '-'.
### Action Items
- Clear next steps using '-'.
Formatting rule: Never use asterisk (*) characters anywhere in your response.`,
  },
  {
    id: 'support',
    label: 'Support Reply',
    description: 'Drafts polite, accurate customer replies from any support message.',
    temperature: 0.3,
    systemPrompt: `You are BriefBot in Customer Support mode.
Draft a warm, empathetic, and concise reply to the customer inquiry.
Keep it under 140 words, acknowledge the issue, state the clear next step, and maintain a helpful tone.
Formatting rule: Never use asterisk (*) characters anywhere in your response. Use '-' for bullets if needed.`,
  },
]

export const SAMPLE_ACTIONS: SampleAction[] = [
  {
    mode: 'summarize',
    badge: 'Summarizer',
    title: 'Summarize a team update into action items',
    prompt: 'Summarize these meeting notes and extract clear action items.',
    contextText: `Weekly Engineering Sync (Nov 20):
1. Checkout webhook latency spiked to 1.8s on Tuesday after traffic doubled. Sarah will add an async Redis queue before Friday.
2. Customers asked for CSV export on the analytics dashboard. Design mockups are approved; frontend sprint starts Monday.
3. Gemini API failover reduced 503 errors to 0% during yesterday's peak window. Need to add automated latency alerts next week.`,
  },
  {
    mode: 'support',
    badge: 'Support Draft',
    title: 'Draft a polite refund & outage reply',
    prompt: 'Draft a polite reply to this customer support ticket.',
    contextText: `Hi team, our webhook missed 3 events yesterday during your afternoon outage and we were also double-charged on invoice #4082. Can you fix the billing and explain what happened?`,
  },
  {
    mode: 'chat',
    badge: 'Quick Chat',
    title: 'Explain LLM prompt trade-offs simply',
    prompt: 'Explain the trade-offs between fast flash models and larger reasoning models in 3 short points.',
  },
]
