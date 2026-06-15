#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
image_name="conductor-agent-dev:latest"
container_name="${CONDUCTOR_AGENT_CONTAINER_NAME:-conductor-agent-dev-env-$(date +%Y%m%d%H%M%S)-$$}"
containerfile="$repo_root/Containerfile.dev"
workspace_mount="/workspace"
cache_dir="$repo_root/.podman"
containerfile_hash_file="$cache_dir/containerfile.sha256"
container_home="${CONDUCTOR_AGENT_CONTAINER_HOME:-$workspace_mount/.podman/home}"
published_ports="${CONDUCTOR_AGENT_PORTS:-}"
container_command=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      container_command=("$@")
      break
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [-- command ...]" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$cache_dir"

current_containerfile_hash="$(sha256sum "$containerfile" | awk '{print $1}')"
previous_manifest_hash=""

if [ -f "$containerfile_hash_file" ]; then
  previous_manifest_hash="$(cat "$containerfile_hash_file")"
fi

echo "🚀 Preparing Podman image..."
if ! podman image exists "$image_name" >/dev/null 2>&1; then
  podman build -t "$image_name" -f "$containerfile" "$repo_root"
elif [ "$current_containerfile_hash" != "$previous_manifest_hash" ]; then
  podman build -t "$image_name" -f "$containerfile" "$repo_root"
fi

printf '%s\n' "$current_containerfile_hash" > "$containerfile_hash_file"

echo "💻 Starting container..."
port_args=()
effective_published_ports=()

host_port_is_busy() {
  local port="$1"

  if command -v timeout >/dev/null 2>&1; then
    timeout 0.2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
    return $?
  fi

  bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
}

for port_mapping in $published_ports; do
  host_port="${port_mapping%%:*}"

  if [ -n "$host_port" ]; then
    if host_port_is_busy "$host_port"; then
      echo "⚠️  Skipping host port $host_port for mapping $port_mapping because it is already in use."
      continue
    fi

    port_args+=(--publish "$port_mapping")
    effective_published_ports+=("$port_mapping")
  fi
done

if [ -z "$published_ports" ]; then
  echo "ℹ️  No host ports requested. Set CONDUCTOR_AGENT_PORTS to publish ports."
elif [ "${#effective_published_ports[@]}" -eq 0 ]; then
  echo "⚠️  No host ports were published. Set CONDUCTOR_AGENT_PORTS if you need specific mappings."
fi

podman run \
  --rm \
  --interactive \
  --tty \
  --name "$container_name" \
  --hostname "$container_name" \
  --userns keep-id \
  --security-opt label=disable \
  "${port_args[@]}" \
  --volume "$repo_root:$workspace_mount:rw" \
  --workdir "$workspace_mount" \
  --env HOME="$container_home" \
  --env HOST=0.0.0.0 \
  --tmpfs /tmp:rw,exec,nosuid,nodev \
  "$image_name" \
  bash -lc "
  set -euo pipefail
  mkdir -p \"$container_home\"
  export PATH=\"/usr/local/bin:\$HOME/.local/bin:/root/.local/bin:\$PATH\"
  opencode --version
  echo 'Container name is $container_name.'
  echo 'Container HOME persists at $container_home.'
  echo 'Repo is mounted at $workspace_mount.'
  echo 'Requested ports: ${published_ports:-(none)}.'
  echo 'Published ports: ${effective_published_ports[*]:-(none)}.'

  if [ \"\$#\" -eq 0 ]; then
    exec bash
  fi
  exec \"\$@\"
" 
  bash \
  "${container_command[@]}"
