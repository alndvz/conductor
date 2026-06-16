import type { Plugin } from "@opencode-ai/plugin"

const WATCH_FILES = ["TASKS.md"]

const LOGO = [
  "  ██████╗ ██████╗ ███╗   ██╗██████╗ ██╗   ██╗ ██████╗████████╗ ██████╗ ██████╗ ",
  " ██╔════╝██╔═══██╗████╗  ██║██╔══██╗██║   ██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗",
  " ██║     ██║   ██║██╔██╗ ██║██║  ██║██║   ██║██║        ██║   ██║   ██║██████╔╝",
  " ██║     ██║   ██║██║╚██╗██║██║  ██║██║   ██║██║        ██║   ██║   ██║██╔══██╗",
  " ╚██████╗╚██████╔╝██║ ╚████║██████╔╝╚██████╔╝╚██████╗   ██║   ╚██████╔╝██║  ██║",
  "  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝",
]

export const HelloWorld: Plugin = async ({ client, directory, worktree, $ }) => {
  if (!process.env.CONDUCTOR) return { event: async () => {}, dispose: async () => {} }

  client.app.log({
    body: {
      service: "hello-world",
      level: "info",
      message: `##################################################################################`,
    },
  }).catch(() => {})
  client.app.log({
    body: {
      service: "hello-world",
      level: "info",
      message: `### HELLO-WORLD PLUGIN LOADED | directory=${directory} | worktree=${worktree} ###`,
    },
  }).catch(() => {})

  const activeSessions = new Set<string>()
  const tickIntervals = new Map<string, ReturnType<typeof setInterval>>()
  const fileHashes = new Map<string, string>()
  const sessionStatus = new Map<string, "idle" | "busy" | "retry">()
  const pendingMessages = new Map<string, { text: string; noReply: boolean }[]>()

  async function gitHash(file: string) {
    const result = await $`git -C ${worktree} log -1 --format=%H -- ${file}`.quiet()
    return result.stdout.toString().trim() || ""
  }

  async function gitDiff(from: string, to: string, file: string) {
    const result = await $`git -C ${worktree} diff ${from}..${to} -- ${file}`.quiet()
    return result.stdout.toString().trim() || "(empty diff)"
  }

  async function drainPending(sessionID: string) {
    const messages = pendingMessages.get(sessionID)
    if (!messages || messages.length === 0) return
    pendingMessages.set(sessionID, [])
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
    const status = sessionStatus.get(sessionID)
    if (status === "busy" || status === "retry") {
      const queue = pendingMessages.get(sessionID) || []
      queue.push({ text: message, noReply })
      pendingMessages.set(sessionID, queue)
      await client.app.log({
        body: {
          service: "hello-world",
          level: "info",
          message: `### HELLO-WORLD QUEUED | session=${sessionID} | message=${message} ###`,
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
          service: "hello-world",
          level: "info",
          message: `### HELLO-WORLD TICK | session=${sessionID} ###`,
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
      const hash = await gitHash(file)
      await client.app.log({
        body: {
          service: "hello-world",
          level: "info",
          message: `### HELLO-WORLD POLL | file=${file} | hash=${hash || "(none)"} ###`,
        },
      })
      if (!hash) continue
      const previous = fileHashes.get(file)
      fileHashes.set(file, hash)
      if (previous && previous !== hash) {
        await client.app.log({
          body: {
            service: "hello-world",
            level: "info",
            message: `### HELLO-WORLD FILE CHANGED | file=${file} | previous=${previous} | current=${hash} ###`,
          },
        })
        const diff = await gitDiff(previous, hash, file)
        const codeFence = "```"
        await notifyAllSessions(`File ${file} changed (commit ${hash.slice(0, 7)})\n\n${codeFence}diff\n${diff}\n${codeFence}`)
      }
    }
  }, 5000)

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        activeSessions.add(sessionID)

        await client.app.log({
          body: {
            service: "hello-world",
            level: "info",
            message: `### HELLO-WORLD SESSION CREATED | session=${sessionID} | directory=${directory} ###`,
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
            service: "hello-world",
            level: "info",
            message: `### HELLO-WORLD AGENT SWITCHED | session=${sessionID} | agent=${agent} ###`,
          },
        })
        await sendOrQueue(sessionID, `Agent switched to ${agent}`, true)
      }

      if (event.type === "session.status") {
        const { sessionID, status } = event.properties || {}
        if (!sessionID || !status) return
        sessionStatus.set(sessionID, status.type)
        if (status.type === "idle") {
          await drainPending(sessionID)
        }
      }

      if (event.type === "session.idle") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        sessionStatus.set(sessionID, "idle")
        await drainPending(sessionID)
      }

      if (event.type === "session.deleted") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        activeSessions.delete(sessionID)
        stopTick(sessionID)
        sessionStatus.delete(sessionID)
        pendingMessages.delete(sessionID)
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
