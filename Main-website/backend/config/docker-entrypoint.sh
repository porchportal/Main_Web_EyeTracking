#!/bin/bash
set -e

# MongoDB custom entrypoint to handle initialization with custom config

echo "Starting MongoDB initialization..."

# Check if this is the first run (no data directory or empty)
if [ ! -f /data/db/mongod.lock ] || [ ! -d /data/db/journal ]; then
    echo "First run detected - initializing database..."

    # Start MongoDB without auth temporarily for initialization
    echo "Starting MongoDB without authentication..."
    mongod --config /etc/mongod.conf --fork --logpath /var/log/mongodb/init.log --bind_ip_all

    # Wait for MongoDB to be ready with timeout
    echo "Waiting for MongoDB to start..."
    MAX_TRIES=30
    COUNT=0
    until mongosh --quiet --eval "db.adminCommand('ping').ok" > /dev/null 2>&1; do
        COUNT=$((COUNT + 1))
        if [ $COUNT -ge $MAX_TRIES ]; then
            echo "ERROR: MongoDB failed to start after $MAX_TRIES attempts"
            cat /var/log/mongodb/init.log
            exit 1
        fi
        echo "Waiting... attempt $COUNT/$MAX_TRIES"
        sleep 2
    done

    echo "MongoDB started successfully, running initialization script..."

    # Run the initialization script with error handling
    mongosh --quiet <<EOF || { echo "ERROR: Failed to create users"; cat /var/log/mongodb/init.log; exit 1; }
use admin

// Create root user
try {
    db.createUser({
      user: "${MONGO_INITDB_ROOT_USERNAME}",
      pwd: "${MONGO_INITDB_ROOT_PASSWORD}",
      roles: [ { role: "root", db: "admin" } ]
    });
    print('✓ Created root user: ${MONGO_INITDB_ROOT_USERNAME}');
} catch (e) {
    if (e.code !== 51003) { // Ignore "user already exists" error
        throw e;
    }
    print('Root user already exists');
}

// Switch to application database
use ${MONGO_INITDB_DATABASE}

// Create application user
try {
    db.createUser({
      user: "${MONGO_USERNAME}",
      pwd: "${MONGO_PASSWORD}",
      roles: [
        { role: 'readWrite', db: '${MONGO_INITDB_DATABASE}' },
        { role: 'dbAdmin', db: '${MONGO_INITDB_DATABASE}' }
      ]
    });
    print('✓ Created app user: ${MONGO_USERNAME} with readWrite and dbAdmin roles on ${MONGO_INITDB_DATABASE} database');
} catch (e) {
    if (e.code !== 51003) { // Ignore "user already exists" error
        throw e;
    }
    print('App user already exists');
}

print('✓ MongoDB initialization completed successfully');
EOF

    echo "Initialization script completed successfully"

    # Shutdown temporary MongoDB gracefully
    echo "Shutting down temporary MongoDB..."
    mongosh admin --quiet --eval "db.shutdownServer({ force: false, timeoutSecs: 10 })" 2>/dev/null || true

    # Wait for shutdown to complete
    sleep 5

    # Force kill if still running
    pkill -9 mongod || true
    sleep 2
fi

# Start MongoDB normally with auth
echo "Starting MongoDB with authentication enabled..."
exec mongod --config /etc/mongod.conf --auth --bind_ip_all
