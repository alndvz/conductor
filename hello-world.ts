import type { Plugin } from "@opencode-ai/plugin"

const WATCH_FILES = ["TASKS.md"]

export const HelloWorld: Plugin = async ({ client, directory, worktree, $ }) => {
  await client.app.log({
    body: {
      service: "hello-world",
      level: "info",
      message: `##################################################################################`,
    },
  })
  await client.app.log({
    body: {
      service: "hello-world",
      level: "info",
      message: `### HELLO-WORLD PLUGIN LOADED | directory=${directory} | worktree=${worktree} ###`,
    },
  })

  const activeSessions = new Set<string>()
  const tickIntervals = new Map<string, ReturnType<typeof setInterval>>()
  const fileHashes = new Map<string, string>()

  async function gitHash(file: string) {
    const result = await $`git -C ${worktree} log -1 --format=%H -- ${file}`.quiet()
    return result.stdout.toString().trim() || ""
  }

  async function notifyAllSessions(message: string) {
    for (const sessionID of activeSessions) {
      await client.session.prompt({
        path: { id: sessionID },
        body: {
          noReply: true,
          parts: [{ type: "text", text: message }],
        },
      }).catch(() => {})
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
      await client.session.prompt({
        path: { id: sessionID },
        body: {
          noReply: true,
          parts: [{ type: "text", text: "TICK" }],
        },
      }).catch(() => {})
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
        await notifyAllSessions(`File ${file} changed (commit ${hash.slice(0, 7)})`)
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

        await client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [{ type: "text", text: "WHAT IS YOUR NAME" }],
          },
        }).catch(() => {})

        startTick(sessionID)
      }

      if (event.type === "session.deleted") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return
        activeSessions.delete(sessionID)
        stopTick(sessionID)
      }
    },

    dispose: async () => {
      clearInterval(pollInterval)
      for (const id of tickIntervals.values()) clearInterval(id)
      tickIntervals.clear()
      activeSessions.clear()
      fileHashes.clear()
    },
  }
}
