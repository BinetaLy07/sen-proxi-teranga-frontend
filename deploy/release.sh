#!/usr/bin/env bash
set -Eeuo pipefail
image="senproxi-frontend:${1:?Missing image tag}"
archive="${2:?Missing archive}"
[[ "$1" =~ ^[a-f0-9]{40}$ ]]
[[ "$archive" == /tmp/senproxi-frontend-*.tar.gz ]]
trap 'rm -f -- "$archive"' EXIT
command -v docker >/dev/null
command -v curl >/dev/null
docker info >/dev/null
gzip -dc "$archive" | docker load
docker network inspect senproxi >/dev/null 2>&1 || docker network create senproxi >/dev/null
proxy_network=
routing=()
if [[ -s /opt/sen-proxi-teranga/frontend.env ]]; then
    public_host="$(sed -n 's/^PUBLIC_HOST=//p' /opt/sen-proxi-teranga/frontend.env)"
    proxy_network="$(sed -n 's/^TRAEFIK_NETWORK=//p' /opt/sen-proxi-teranga/frontend.env)"
    [[ "$public_host" =~ ^[a-zA-Z0-9.-]+$ ]]
    [[ "$proxy_network" =~ ^[a-zA-Z0-9_.-]+$ ]]
    docker network inspect "$proxy_network" >/dev/null
    routing=(
        --label traefik.enable=true
        --label "traefik.docker.network=$proxy_network"
        --label 'traefik.http.routers.senproxi-http.entrypoints=web'
        --label "traefik.http.routers.senproxi-http.rule=Host(\`$public_host\`)"
        --label 'traefik.http.routers.senproxi-http.middlewares=senproxi-https'
        --label 'traefik.http.middlewares.senproxi-https.redirectscheme.scheme=https'
        --label 'traefik.http.routers.senproxi.entrypoints=websecure'
        --label "traefik.http.routers.senproxi.rule=Host(\`$public_host\`)"
        --label 'traefik.http.routers.senproxi.tls.certresolver=letsencrypt'
        --label 'traefik.http.services.senproxi.loadbalancer.server.port=80'
    )
fi
name=senproxi-frontend
previous="$name-previous"
docker rm -f "$previous" >/dev/null 2>&1 || true
had_previous=false
if docker container inspect "$name" >/dev/null 2>&1; then
    docker stop "$name" >/dev/null
    docker rename "$name" "$previous"
    had_previous=true
fi
rollback() {
    docker logs --tail 60 "$name" >&2 || true
    docker rm -f "$name" >/dev/null 2>&1 || true
    if "$had_previous"; then
        docker rename "$previous" "$name"
        docker start "$name" >/dev/null
    fi
    echo "Deployment failed; previous container restored when available." >&2
    exit 1
}
docker run --detach --name "$name" --restart unless-stopped \
    --network senproxi --publish 127.0.0.1:8088:80 --memory=128m --cpus=1 \
    "${routing[@]}" \
    --log-opt max-size=10m --log-opt max-file=3 "$image" || rollback
if [[ -n "$proxy_network" ]]; then
    docker network connect "$proxy_network" "$name" || rollback
fi
ready=false
for attempt in $(seq 1 30); do
    if curl --fail --silent --max-time 5 http://127.0.0.1:8088/connexion >/dev/null; then
        ready=true
        break
    fi
    sleep 2
done
"$ready" || rollback
docker rm "$previous" >/dev/null 2>&1 || true
echo "Deployed $image successfully."
