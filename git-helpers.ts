import type { PluginInput } from "@opencode-ai/plugin"

type Shell = PluginInput["$"]

export async function gitHash($: Shell, worktree: string, file: string): Promise<string> {
  const result = await $`git -C ${worktree} log -1 --format=%H -- ${file}`.quiet()
  return result.stdout.toString().trim() || ""
}

export async function gitDiff($: Shell, worktree: string, from: string, to: string, file: string): Promise<string> {
  const result = await $`git -C ${worktree} diff ${from}..${to} -- ${file}`.quiet()
  return result.stdout.toString().trim() || "(empty diff)"
}
