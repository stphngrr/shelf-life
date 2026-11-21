// ABOUTME: Reads the local Mailpit inbox, which catches emails sent by the local Supabase auth server.
// ABOUTME: Lets tests find and follow real magic-link emails.

interface MailpitSummary {
  ID: string
  To: { Address: string }[]
}

function mailpitUrl(path: string): string {
  const base = process.env.MAILPIT_URL
  if (!base) throw new Error('Missing env var MAILPIT_URL; copy .env.example to .env.local and fill it in')
  return `${base}${path}`
}

export async function clearMailbox(): Promise<void> {
  const response = await fetch(mailpitUrl('/api/v1/messages'), { method: 'DELETE' })
  if (!response.ok) throw new Error(`Mailpit clear failed: ${response.status}`)
}

async function messagesTo(address: string): Promise<MailpitSummary[]> {
  const response = await fetch(mailpitUrl('/api/v1/messages'))
  if (!response.ok) throw new Error(`Mailpit list failed: ${response.status}`)
  const { messages } = (await response.json()) as { messages: MailpitSummary[] }
  return messages.filter((message) => message.To.some((to) => to.Address === address))
}

export async function countMessagesTo(address: string): Promise<number> {
  return (await messagesTo(address)).length
}

/** Waits for an email to `address` and returns the first link in its plain-text body. */
export async function magicLinkSentTo(address: string, timeoutMs = 5000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [message] = await messagesTo(address)
    if (message) {
      const response = await fetch(mailpitUrl(`/api/v1/message/${message.ID}`))
      const { Text } = (await response.json()) as { Text: string }
      const link = Text.match(/https?:\/\/\S+/)?.[0]
      if (!link) throw new Error(`Email to ${address} has no link:\n${Text}`)
      return link
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`No email to ${address} within ${timeoutMs}ms`)
}
