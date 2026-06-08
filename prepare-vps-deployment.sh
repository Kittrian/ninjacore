#!/bin/bash
# Deploy NinjaCore to VPS

set -e

DEPLOY_DIR="/opt/ninjacore"
BACKEND_BINARY="ninjacore/target/release/ninjacore"

if [ ! -f "$BACKEND_BINARY" ]; then
    echo "Error: Rust backend binary not built yet"
    echo "Run: cargo build --release from ninjacore/ directory"
    exit 1
fi

echo "📦 Preparing deployment package..."

# Create deployment tarball
tar --exclude='.git' \
    --exclude='target' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    -czf ninjacore-deploy.tar.gz \
    . --transform 's,^\.,ninjacore,'

echo "✓ Created ninjacore-deploy.tar.gz"
echo ""
echo "📤 To deploy to VPS:"
echo ""
echo "  sshpass -p Malachi77 scp ninjacore-deploy.tar.gz root@5.78.214.176:/tmp/"
echo "  sshpass -p Malachi77 ssh root@5.78.214.176 << 'EOF'"
echo "    mkdir -p $DEPLOY_DIR"
echo "    cd $DEPLOY_DIR"
echo "    tar -xzf /tmp/ninjacore-deploy.tar.gz"
echo "    docker-compose up -d"
echo "    curl http://localhost:3100"
echo "  EOF"
echo ""
