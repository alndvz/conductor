#!/usr/bin/env bash
export CONDUCTOR=1
exec opencode --agent conductor --prompt "YOU are the conductor." "$@"
