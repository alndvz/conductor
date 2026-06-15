#!/bin/bash
set -euo pipefail

logfile="${XDG_DATA_HOME:-$HOME/.local/share}/opencode/log/opencode.log"

if [ ! -f "$logfile" ]; then
  echo "Log file not found: $logfile" >&2
  echo "Run opencode first to create it." >&2
  exit 1
fi

echo "Tailing $logfile"
tail -f "$logfile"
