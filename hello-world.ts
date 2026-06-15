import type { Plugin } from "@opencode-ai/plugin"

export const HelloWorld: Plugin = async ({ client, directory, worktree }) => {
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

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        await client.app.log({
          body: {
            service: "hello-world",
            level: "info",
            message: `### HELLO-WORLD SESSION CREATED | directory=${directory} | worktree=${worktree} ###`,
          },
        })
      }
    },
  }
}
