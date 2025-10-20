#!/bin/bash
# Helper script to run docker-compose with correct user permissions

export UID=$(id -u)
export GID=$(id -g)

# Enable Docker BuildKit for faster builds with cache mounts
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "Running with UID=${UID} and GID=${GID}"
echo "BuildKit enabled for faster builds"
docker-compose "$@"
