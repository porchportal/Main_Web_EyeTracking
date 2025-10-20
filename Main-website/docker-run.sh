#!/bin/bash
# Helper script to run docker-compose with correct user permissions

export UID=$(id -u)
export GID=$(id -g)

echo "Running with UID=${UID} and GID=${GID}"
docker-compose "$@"
