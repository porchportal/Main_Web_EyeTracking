#!/bin/sh
set -e

# Get UID and GID from environment or use defaults
USER_ID=${UID:-1000}
GROUP_ID=${GID:-1000}

# Create group if it doesn't exist
if ! getent group appgroup > /dev/null 2>&1; then
    addgroup -g "${GROUP_ID}" appgroup
fi

# Create user if it doesn't exist
if ! id -u appuser > /dev/null 2>&1; then
    adduser -u "${USER_ID}" -G appgroup -D -h /home/appuser appuser
fi

# Fix permissions on mounted volumes and working directories
echo "Fixing permissions for application directories..."
chown -R "${USER_ID}:${GROUP_ID}" /app/node_modules 2>/dev/null || true
chown -R "${USER_ID}:${GROUP_ID}" /app/.next 2>/dev/null || true

# Execute the command as the non-root user using su-exec
exec su-exec "${USER_ID}:${GROUP_ID}" "$@"
