#!/bin/bash
set -e

# Get UID and GID from environment or use defaults
USER_ID=${APP_UID:-1000}
GROUP_ID=${APP_GID:-1000}

echo "Starting with UID: ${USER_ID}, GID: ${GROUP_ID}"

# Check if user with this UID already exists
if id -u "${USER_ID}" > /dev/null 2>&1; then
    EXISTING_USER=$(id -un "${USER_ID}")
    echo "Using existing user: $EXISTING_USER (UID: ${USER_ID})"
else
    # Create new user and group
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
    echo "Created user appuser with UID: ${USER_ID}, GID: ${GROUP_ID}"
fi

# Fix permissions on mounted volumes
echo "Fixing permissions for mounted volumes..."
chown -R "${USER_ID}:${GROUP_ID}" /app/resource_security 2>/dev/null || true

# Execute the command as the non-root user
echo "Switching to user UID: ${USER_ID}, GID: ${GROUP_ID}"
exec gosu "${USER_ID}:${GROUP_ID}" "$@"
