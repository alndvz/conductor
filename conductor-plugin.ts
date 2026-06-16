import type { Plugin } from "@opencode-ai/plugin"
import { gitHash, gitDiff } from "./git-helpers.js"
import { shouldQueue, enqueue, dequeueAll } from "./message-queue.js"
import type { QueuedMessage } from "./message-queue.js"
import { addSession, removeSession, setStatus } from "./session-state.js"
import type { SessionStatus } from "./session-state.js"
import { LOGO, formatFileChangeNotification, formatAgentSwitchNotification } from "./notifications.js"

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

        await sendOrQueue(sessionID, LOGO.join("\n"), true)
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
        await sendOrQueue(sessionID, formatAgentSwitchNotification(agent), true)
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
        removeSession(activeSessions, tickIntervals, sessionStatus, pendingMessages, sessionID)
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
    },
  }
}
