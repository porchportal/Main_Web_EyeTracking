#!/bin/bash
set -e

# Get UID and GID from environment or use defaults
USER_ID=${UID:-1000}
GROUP_ID=${GID:-1000}

# Create group if it doesn't exist
if ! getent group appgroup > /dev/null 2>&1; then
    groupadd -g "${GROUP_ID}" appgroup
fi

# Create user if it doesn't exist
if ! id -u appuser > /dev/null 2>&1; then
    useradd -u "${USER_ID}" -g "${GROUP_ID}" -m -s /bin/bash appuser
fi

# Fix permissions on mounted volumes (these will be mounted at runtime)
echo "Fixing permissions for mounted volumes..."
chown -R "${USER_ID}:${GROUP_ID}" /app/resource_security 2>/dev/null || true
chown -R "${USER_ID}:${GROUP_ID}" /app/routes 2>/dev/null || true

# Install gosu if not present
if ! command -v gosu &> /dev/null; then
    apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*
fi

# Execute the command as the non-root user
exec gosu "${USER_ID}:${GROUP_ID}" "$@"
