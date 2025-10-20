#!/bin/bash
# Setup script to create the external nginx_proxy network

echo "Creating external nginx_proxy network..."

# Check if network already exists
if docker network ls | grep -q nginx_proxy; then
    echo "✓ nginx_proxy network already exists"
else
    docker network create nginx_proxy
    echo "✓ nginx_proxy network created successfully"
fi

echo ""
echo "Network setup complete!"
echo "You can now run: ./docker-run.sh up -d"
