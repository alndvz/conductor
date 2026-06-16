export interface QueuedMessage {
  text: string
  noReply: boolean
}

// Determine if a session status means messages should be queued rather than sent
export function shouldQueue(status: string): boolean {
  return status === "busy" || status === "retry"
}

// Enqueue a message for a session. Returns the updated queue array.
export function enqueue(
  pendingMessages: Map<string, QueuedMessage[]>,
  sessionID: string,
  message: QueuedMessage,
): QueuedMessage[] {
  const queue = pendingMessages.get(sessionID) ?? []
  queue.push(message)
  pendingMessages.set(sessionID, queue)
  return queue
}

// Dequeue (drain) all pending messages for a session. Returns the drained array and clears the session's queue.
export function dequeueAll(
  pendingMessages: Map<string, QueuedMessage[]>,
  sessionID: string,
): QueuedMessage[] {
  const messages = pendingMessages.get(sessionID) ?? []
  pendingMessages.set(sessionID, [])
  return messages
}
