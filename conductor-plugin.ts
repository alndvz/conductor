import type { Plugin, PluginInput } from "@opencode-ai/plugin"

// ── Types ────────────────────────────────────────────────────────────────────

type Shell = PluginInput["$"]

interface QueuedMessage {
  text: string
  noReply: boolean
}

type SessionStatus = "idle" | "busy" | "retry"

// ── Git helpers ──────────────────────────────────────────────────────────────

async function gitHash($: Shell, worktree: string, file: string): Promise<string> {
  const result = await $`git -C ${worktree} log -1 --format=%H -- ${file}`.quiet()
  return result.stdout.toString().trim() || ""
}

async function gitDiff($: Shell, worktree: string, from: string, to: string, file: string): Promise<string> {
  const result = await $`git -C ${worktree} diff ${from}..${to} -- ${file}`.quiet()
  return result.stdout.toString().trim() || "(empty diff)"
}

// ── Message queue ────────────────────────────────────────────────────────────

function shouldQueue(status: string): boolean {
  return status === "busy" || status === "retry"
}

function enqueue(
  pendingMessages: Map<string, QueuedMessage[]>,
  sessionID: string,
  message: QueuedMessage,
): QueuedMessage[] {
  const queue = pendingMessages.get(sessionID) ?? []
  queue.push(message)
  pendingMessages.set(sessionID, queue)
  return queue
}

function dequeueAll(
  pendingMessages: Map<string, QueuedMessage[]>,
  sessionID: string,
): QueuedMessage[] {
  const messages = pendingMessages.get(sessionID) ?? []
  pendingMessages.set(sessionID, [])
  return messages
}

// ── Notifications ────────────────────────────────────────────────────────────

const LOGO = [
  "  ██████╗ ██████╗ ███╗   ██╗██████╗ ██╗   ██╗ ██████╗████████╗ ██████╗ ██████╗ ",
  " ██╔════╝██╔═══██╗████╗  ██║██╔══██╗██║   ██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗",
  " ██║     ██║   ██║██╔██╗ ██║██║  ██║██║   ██║██║        ██║   ██║   ██║██████╔╝",
  " ██║     ██║   ██║██║╚██╗██║██║  ██║██║   ██║██║        ██║   ██║   ██║██╔══██╗",
  " ╚██████╗╚██████╔╝██║ ╚████║██████╔╝╚██████╔╝╚██████╗   ██║   ╚██████╔╝██║  ██║",
  "  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝",
]

function formatFileChangeNotification(file: string, commit: string, diff: string): string {
  const codeFence = "```"
  return `File ${file} changed (commit ${commit.slice(0, 7)})\n\n${codeFence}diff\n${diff}\n${codeFence}`
}

function formatAgentSwitchNotification(agent: string): string {
  return `Agent switched to ${agent}`
}

// ── Session state ────────────────────────────────────────────────────────────

function addSession(activeSessions: Set<string>, sessionID: string): void {
  activeSessions.add(sessionID)
}

function removeSession(
  activeSessions: Set<string>,
  tickIntervals: Map<string, ReturnType<typeof setInterval>>,
  sessionStatus: Map<string, SessionStatus>,
  pendingMessages: Map<string, unknown[]>,
  giftedSessions: Set<string>,
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
  giftedSessions.delete(sessionID)
}

function setStatus(
  sessionStatus: Map<string, SessionStatus>,
  sessionID: string,
  status: SessionStatus,
): void {
  sessionStatus.set(sessionID, status)
}

function getStatus(
  sessionStatus: Map<string, SessionStatus>,
  sessionID: string,
): SessionStatus | undefined {
  return sessionStatus.get(sessionID)
}

// ── Plugin ───────────────────────────────────────────────────────────────────

const WATCH_FILES = ["TASKS.md"]

export const ConductorPlugin: Plugin = async ({ client, directory, worktree, $ }) => {
  if (!process.env.CONDUCTOR) return { event: async () => {}, dispose: async () => {} }

  client.app.log({
    body: {
      service: "conductor-plugin",
      level: "info",
      message: `##################################################################################`,
    },
  }).catch(() => {})
  client.app.log({
    body: {
      service: "conductor-plugin",
      level: "info",
      message: `### CONDUCTOR-PLUGIN PLUGIN LOADED | directory=${directory} | worktree=${worktree} ###`,
    },
  }).catch(() => {})

  const activeSessions = new Set<string>()
  const tickIntervals = new Map<string, ReturnType<typeof setInterval>>()
  const fileHashes = new Map<string, string>()
  const sessionStatus = new Map<string, SessionStatus>()
  const pendingMessages = new Map<string, QueuedMessage[]>()
  const giftedSessions = new Set<string>()

  async function drainPending(sessionID: string) {
    const messages = dequeueAll(pendingMessages, sessionID)
    if (messages.length === 0) return
    for (const { text, noReply } of messages) {
      await client.session.prompt({
        path: { id: sessionID },
        body: {
          agent: "conductor",
          noReply,
          parts: [{ type: "text", text }],
        },
      }).catch(() => {})
    }
  }

  async function sendOrQueue(sessionID: string, message: string, noReply = false) {
    if (shouldQueue(sessionStatus.get(sessionID) ?? "")) {
      enqueue(pendingMessages, sessionID, { text: message, noReply })
      await client.app.log({
        body: {
          service: "conductor-plugin",
          level: "info",
          message: `### CONDUCTOR-PLUGIN QUEUED | session=${sessionID} | message=${message} ###`,
        },
      })
      return
    }
    await client.session.prompt({
      path: { id: sessionID },
      body: {
        agent: "conductor",
        noReply,
        parts: [{ type: "text", text: message }],
      },
    }).catch(() => {})
  }

  async function notifyAllSessions(message: string) {
    for (const sessionID of activeSessions) {
      await sendOrQueue(sessionID, message)
    }
  }

  function startTick(sessionID: string) {
    if (tickIntervals.has(sessionID)) return
    const id = setInterval(async () => {
      await client.app.log({
        body: {
          service: "conductor-plugin",
          level: "info",
          message: `### CONDUCTOR-PLUGIN TICK | session=${sessionID} ###`,
        },
      })
    }, 10000)
    tickIntervals.set(sessionID, id)
  }

  function stopTick(sessionID: string) {
    const id = tickIntervals.get(sessionID)
    if (id) {
      clearInterval(id)
      tickIntervals.delete(sessionID)
    }
  }

  const pollInterval = setInterval(async () => {
    for (const file of WATCH_FILES) {
      const hash = await gitHash($, worktree, file)
      await client.app.log({
        body: {
          service: "conductor-plugin",
          level: "info",
          message: `### CONDUCTOR-PLUGIN POLL | file=${file} | hash=${hash || "(none)"} ###`,
        },
      })
      if (!hash) continue
      const previous = fileHashes.get(file)
      fileHashes.set(file, hash)
      if (previous && previous !== hash) {
        await client.app.log({
          body: {
            service: "conductor-plugin",
            level: "info",
            message: `### CONDUCTOR-PLUGIN FILE CHANGED | file=${file} | previous=${previous} | current=${hash} ###`,
          },
        })
        const diff = await gitDiff($, worktree, previous, hash, file)
        await notifyAllSessions(formatFileChangeNotification(file, hash, diff))
      }
    }
  }, 5000)

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        addSession(activeSessions, sessionID)

        await client.app.log({
          body: {
            service: "conductor-plugin",
            level: "info",
            message: `### CONDUCTOR-PLUGIN SESSION CREATED | session=${sessionID} | directory=${directory} ###`,
          },
        })

        startTick(sessionID)
      }

      if (event.type === "session.next.agent.switched") {
        const { sessionID, agent } = event.properties || {}
        if (!sessionID) return
        await client.app.log({
          body: {
            service: "conductor-plugin",
            level: "info",
            message: `### CONDUCTOR-PLUGIN AGENT SWITCHED | session=${sessionID} | agent=${agent} ###`,
          },
        })
        if (agent === "conductor" && !giftedSessions.has(sessionID)) {
          giftedSessions.add(sessionID)
          await sendOrQueue(sessionID, LOGO.join("\n"), true)
        } else {
          await sendOrQueue(sessionID, formatAgentSwitchNotification(agent), true)
        }
      }

      if (event.type === "session.status") {
        const { sessionID, status } = event.properties || {}
        if (!sessionID || !status) return
        setStatus(sessionStatus, sessionID, status.type as SessionStatus)
        if (status.type === "idle") {
          await drainPending(sessionID)
        }
      }

      if (event.type === "session.idle") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        setStatus(sessionStatus, sessionID, "idle")
        await drainPending(sessionID)
      }

      if (event.type === "session.deleted") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        removeSession(activeSessions, tickIntervals, sessionStatus, pendingMessages, giftedSessions, sessionID)
      }
    },

    dispose: async () => {
      clearInterval(pollInterval)
      for (const id of tickIntervals.values()) clearInterval(id)
      tickIntervals.clear()
      activeSessions.clear()
      fileHashes.clear()
      sessionStatus.clear()
      pendingMessages.clear()
      giftedSessions.clear()
    },
  }
}
