export type SessionStatus = "idle" | "busy" | "retry"

export function addSession(activeSessions: Set<string>, sessionID: string): void {
  activeSessions.add(sessionID)
}

export function removeSession(
  activeSessions: Set<string>,
  tickIntervals: Map<string, ReturnType<typeof setInterval>>,
  sessionStatus: Map<string, SessionStatus>,
  pendingMessages: Map<string, unknown[]>,
  sessionID: string,
): void {
  activeSessions.delete(sessionID)
  const intervalId = tickIntervals.get(sessionID)
  if (intervalId) {
    clearInterval(intervalId)
    tickIntervals.delete(sessionID)
  }
  sessionStatus.delete(sessionID)
  pendingMessages.delete(sessionID)
}

export function setStatus(
  sessionStatus: Map<string, SessionStatus>,
  sessionID: string,
  status: SessionStatus,
): void {
  sessionStatus.set(sessionID, status)
}

export function getStatus(
  sessionStatus: Map<string, SessionStatus>,
  sessionID: string,
): SessionStatus | undefined {
  return sessionStatus.get(sessionID)
}
