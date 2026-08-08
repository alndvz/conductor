#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
image_name="conductor-agent-dev:latest"
container_name="${CONDUCTOR_AGENT_CONTAINER_NAME:-conductor-agent-dev-env-$(date +%Y%m%d%H%M%S)-$$}"
containerfile="$repo_root/Containerfile.dev"
workspace_mount="/workspace"
container_home="/conductor-home"
published_ports="${CONDUCTOR_AGENT_PORTS:-}"
container_command=()
container_runtime=""
home_volume="${CONDUCTOR_AGENT_HOME_VOLUME:-}"
containerfile_hash_label="io.conductor.containerfile-hash"
egress_allowlist="$repo_root/dev-egress-allowlist.txt"
squid_config="$repo_root/dev-squid.conf"
proxy_container_name="$container_name-egress-proxy"
internal_network="$container_name-internal"
external_network="$container_name-external"
proxy_started=0
internal_network_created=0
external_network_created=0

hash_value() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi

  shasum -a 256 "$1" | awk '{print $1}'
}

hash_string() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
    return
  fi

  printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
}

host_port_is_busy() {
  local port="$1"

  if command -v timeout >/dev/null 2>&1; then
    timeout 0.2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
    return $?
  fi

  bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
}

cleanup() {
  local exit_code="$?"
  trap - EXIT INT TERM

  if [ "$proxy_started" -eq 1 ]; then
    "$container_runtime" rm --force "$proxy_container_name" >/dev/null 2>&1 || true
  fi
  if [ "$internal_network_created" -eq 1 ]; then
    "$container_runtime" network rm "$internal_network" >/dev/null 2>&1 || true
  fi
  if [ "$external_network_created" -eq 1 ]; then
    "$container_runtime" network rm "$external_network" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

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

if command -v podman >/dev/null 2>&1; then
  container_runtime="podman"
elif command -v docker >/dev/null 2>&1; then
  container_runtime="docker"
else
  echo "Neither podman nor docker is installed. Install podman or docker and try again." >&2
  exit 1
fi

if [ -z "$home_volume" ]; then
  repo_hash="$(hash_string "$repo_root" | cut -c1-12)"
  home_volume="conductor-agent-home-$repo_hash"
fi

current_containerfile_hash="$(hash_string "$(hash_value "$containerfile") $(hash_value "$egress_allowlist") $(hash_value "$squid_config")")"
previous_manifest_hash=""

if "$container_runtime" image inspect "$image_name" >/dev/null 2>&1; then
  previous_manifest_hash="$("$container_runtime" image inspect --format "{{ index .Config.Labels \"$containerfile_hash_label\" }}" "$image_name" 2>/dev/null || true)"
fi

echo "🚀 Preparing $container_runtime image..."
if ! "$container_runtime" image inspect "$image_name" >/dev/null 2>&1; then
  "$container_runtime" build \
    --label "$containerfile_hash_label=$current_containerfile_hash" \
    -t "$image_name" \
    -f "$containerfile" \
    "$repo_root"
elif [ "$current_containerfile_hash" != "$previous_manifest_hash" ]; then
  "$container_runtime" build \
    --label "$containerfile_hash_label=$current_containerfile_hash" \
    -t "$image_name" \
    -f "$containerfile" \
    "$repo_root"
fi

if ! "$container_runtime" volume inspect "$home_volume" >/dev/null 2>&1; then
  "$container_runtime" volume create "$home_volume" >/dev/null
fi

prep_args=(--rm --volume "$home_volume:$container_home")

case "$container_runtime" in
  podman)
    prep_args+=(--userns keep-id --security-opt label=disable)
    ;;
esac

prep_args+=(--user root)

"$container_runtime" run \
  "${prep_args[@]}" \
  "$image_name" \
  bash -lc "
  set -euo pipefail
  mkdir -p '$container_home'
  chown $(id -u):$(id -g) '$container_home' 2>/dev/null || true
  chmod 0700 '$container_home'
"

echo "💻 Starting container with $container_runtime..."
port_args=()
effective_published_ports=()
runtime_args=()

trap cleanup EXIT INT TERM

"$container_runtime" network create --internal "$internal_network" >/dev/null
internal_network_created=1
"$container_runtime" network create "$external_network" >/dev/null
external_network_created=1

"$container_runtime" run \
  --detach \
  --name "$proxy_container_name" \
  --network "$internal_network" \
  --network "$external_network" \
  "$image_name" \
  squid -N -f /etc/squid/conductor-squid.conf >/dev/null
proxy_started=1

proxy_ip="$($container_runtime inspect --format "{{with index .NetworkSettings.Networks \"$internal_network\"}}{{.IPAddress}}{{end}}" "$proxy_container_name")"
if [ -z "$proxy_ip" ]; then
  echo "Could not determine the egress proxy address." >&2
  exit 1
fi

proxy_url="http://$proxy_ip:3128"

case "$container_runtime" in
  podman)
    runtime_args+=(--userns keep-id --security-opt label=disable)
    ;;
  docker)
    runtime_args+=(--user "$(id -u):$(id -g)")
    ;;
esac

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

run_args=(
  run
  --rm
  --interactive
  --tty
  --name "$container_name"
  --hostname "$container_name"
  --network "$internal_network"
  --dns 127.0.0.1
  --add-host "conductor-egress-proxy:$proxy_ip"
)

if [ "${#runtime_args[@]}" -gt 0 ]; then
  run_args+=("${runtime_args[@]}")
fi

if [ "${#port_args[@]}" -gt 0 ]; then
  run_args+=("${port_args[@]}")
fi

run_args+=(
  --volume "$repo_root:$workspace_mount:rw"
  --volume "$home_volume:$container_home"
  --workdir "$workspace_mount"
  --env HOME="$container_home"
  --env HOST=0.0.0.0
  --env HTTP_PROXY="$proxy_url"
  --env HTTPS_PROXY="$proxy_url"
  --env http_proxy="$proxy_url"
  --env https_proxy="$proxy_url"
  --env NO_PROXY="localhost,127.0.0.1,::1"
  --env no_proxy="localhost,127.0.0.1,::1"
  --tmpfs /tmp:rw,exec,nosuid,nodev
  "$image_name"
  bash -lc "
  set -euo pipefail
  mkdir -p \"\$HOME\"
  export PATH=\"/usr/local/bin:\$HOME/.local/bin:\$PATH\"
  opencode --version
  echo 'Using runtime: $container_runtime.'
  echo 'Container name is $container_name.'
  echo 'Container HOME persists in named volume $home_volume at $container_home.'
  echo 'Repo is mounted at $workspace_mount.'
  echo 'Outbound HTTP(S) is restricted by dev-egress-allowlist.txt.'
  echo 'Requested ports: ${published_ports:-(none)}.'
  echo 'Published ports: ${effective_published_ports[*]:-(none)}.'

  if [ \"\$#\" -eq 0 ]; then
    exec bash
  fi
  exec \"\$@\"
"
  bash
)

if [ "${#container_command[@]}" -gt 0 ]; then
  run_args+=("${container_command[@]}")
fi

"$container_runtime" "${run_args[@]}"
