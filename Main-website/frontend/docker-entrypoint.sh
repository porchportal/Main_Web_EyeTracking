#!/bin/sh
set -e

# Get UID and GID from environment or use defaults
# Use APP_UID/APP_GID instead of UID/GID because UID is a read-only shell variable
USER_ID=${APP_UID:-1000}
GROUP_ID=${APP_GID:-1000}

# If running as root (UID 0), fix permissions and run as root
if [ "$USER_ID" = "0" ]; then
    echo "Running as root user..."
    # Still fix ownership for host user access
    chown -R 1000:1000 /app/node_modules 2>/dev/null || true
    chown -R 1000:1000 /app/.next 2>/dev/null || true
    exec "$@"
fi

# For UID 1000, use the existing node user (Alpine node image has node:node as 1000:1000)
if [ "$USER_ID" = "1000" ] && [ "$GROUP_ID" = "1000" ]; then
    echo "Using existing node user (UID: 1000, GID: 1000)"

    # Fix permissions on mounted volumes and working directories
    echo "Fixing permissions for application directories..."
    chown -R 1000:1000 /app/node_modules 2>/dev/null || true
    chown -R 1000:1000 /app/.next 2>/dev/null || true

    # Execute the command as the node user
    exec su-exec 1000:1000 "$@"
fi

# For other UIDs, try to detect existing user or create new one
EXISTING_USER=""
if getent passwd "${USER_ID}" > /dev/null 2>&1; then
    EXISTING_USER=$(getent passwd "${USER_ID}" | cut -d: -f1)
    echo "Using existing user: $EXISTING_USER (UID: ${USER_ID})"
else
    # Check if a group with this GID already exists
    EXISTING_GROUP=$(getent group "${GROUP_ID}" | cut -d: -f1 || true)
    if [ -n "$EXISTING_GROUP" ]; then
        echo "Using existing group: $EXISTING_GROUP (GID: ${GROUP_ID})"
        GROUP_NAME="$EXISTING_GROUP"
    else
        # Create new group
        addgroup -g "${GROUP_ID}" appgroup
        GROUP_NAME="appgroup"
    fi

    # Create new user
    adduser -u "${USER_ID}" -G "$GROUP_NAME" -D -h /home/appuser appuser
    EXISTING_USER="appuser"
    echo "Created new user: $EXISTING_USER (UID: ${USER_ID})"
fi

# Fix permissions on mounted volumes and working directories
echo "Fixing permissions for application directories..."
chown -R "${USER_ID}:${GROUP_ID}" /app/node_modules 2>/dev/null || true
chown -R "${USER_ID}:${GROUP_ID}" /app/.next 2>/dev/null || true

# Execute the command as the non-root user using su-exec
exec su-exec "${USER_ID}:${GROUP_ID}" "$@"
