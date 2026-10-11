#!/usr/bin/env bash
set -Eeuo pipefail
: "${VPS_HOST:?Configure VPS_HOST}"
: "${VPS_USER:?Configure VPS_USER}"
: "${VPS_SSH_KEY:?Configure VPS_SSH_KEY}"
: "${VPS_KNOWN_HOSTS:?Configure VPS_KNOWN_HOSTS}"
: "${IMAGE_TAG:?Missing image tag}"
VPS_PORT="${VPS_PORT:-22}"
[[ "$VPS_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]
[[ "$VPS_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$VPS_PORT" =~ ^[0-9]+$ ]]
[[ "$IMAGE_TAG" =~ ^[a-f0-9]{40}$ ]]
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
chmod 700 "$work"
printf '%s\n' "$VPS_SSH_KEY" > "$work/key"
printf '%s\n' "$VPS_KNOWN_HOSTS" > "$work/known_hosts"
chmod 600 "$work/key" "$work/known_hosts"
options=(-i "$work/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$work/known_hosts" -o ConnectTimeout=15)
archive="/tmp/senproxi-frontend-${IMAGE_TAG}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}.tar.gz"
docker save "senproxi-frontend:$IMAGE_TAG" | gzip > "$work/image.tar.gz"
scp "${options[@]}" -P "$VPS_PORT" "$work/image.tar.gz" "$VPS_USER@$VPS_HOST:$archive"
ssh "${options[@]}" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" bash -s -- "$IMAGE_TAG" "$archive" < deploy/release.sh
