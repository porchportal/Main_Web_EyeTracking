#!/bin/bash
set -e

# Get UID and GID from environment or use defaults
# Use APP_UID/APP_GID instead of UID/GID because UID is a read-only shell variable
USER_ID=${APP_UID:-1000}
GROUP_ID=${APP_GID:-1000}

# If running as root (UID 0), fix permissions and run as root
if [ "$USER_ID" = "0" ]; then
    echo "Running as root user..."
    # Still fix ownership for host user access
    chown -R 1000:1000 /app/resource_security 2>/dev/null || true
    chown -R 1000:1000 /app/routes 2>/dev/null || true
    exec "$@"
fi

# Check if user with this UID already exists
if id -u "${USER_ID}" > /dev/null 2>&1; then
    EXISTING_USER=$(id -un "${USER_ID}")
    echo "Using existing user: $EXISTING_USER (UID: ${USER_ID})"

    # Fix permissions on mounted volumes
    echo "Fixing permissions for mounted volumes..."
    chown -R "${USER_ID}:${GROUP_ID}" /app/resource_security 2>/dev/null || true
    chown -R "${USER_ID}:${GROUP_ID}" /app/routes 2>/dev/null || true

    # Execute the command as the existing user
    exec gosu "${USER_ID}:${GROUP_ID}" "$@"
fi

# If we get here, create new user and group
# Check if a group with this GID already exists
EXISTING_GROUP=$(getent group "${GROUP_ID}" | cut -d: -f1 || true)
if [ -n "$EXISTING_GROUP" ]; then
    echo "Using existing group: $EXISTING_GROUP (GID: ${GROUP_ID})"
    GROUP_NAME="$EXISTING_GROUP"
else
    # Create new group
    groupadd -g "${GROUP_ID}" appgroup
    GROUP_NAME="appgroup"
fi

# Create new user
useradd -u "${USER_ID}" -g "${GROUP_ID}" -m -s /bin/bash appuser

# Fix permissions on mounted volumes
echo "Fixing permissions for mounted volumes..."
chown -R "${USER_ID}:${GROUP_ID}" /app/resource_security 2>/dev/null || true
chown -R "${USER_ID}:${GROUP_ID}" /app/routes 2>/dev/null || true

# Execute the command as the non-root user
exec gosu "${USER_ID}:${GROUP_ID}" "$@"
