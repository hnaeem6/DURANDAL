#!/usr/bin/env bash
set -euo pipefail

# Build the USB deployment bundle for DURANDAL
# Run this on a machine WITH internet to prepare offline deployment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${1:-$PROJECT_DIR/dist/durandal-usb}"
MODEL="${OLLAMA_DEFAULT_MODEL:-qwen2.5:7b}"

echo "╔══════════════════════════════════════╗"
echo "║   DURANDAL USB Build                 ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Output: $BUILD_DIR"
echo ""

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{images,ollama,config,templates,scripts}

# Step 1: Build Docker images
echo "[1/6] Building Docker images..."
cd "$PROJECT_DIR/docker"
docker compose build

# Step 2: Save Docker images to tarballs
echo "[2/6] Saving Docker images (this takes a few minutes)..."
# Get image names from compose
DASHBOARD_IMG=$(docker compose config --images | grep dashboard || echo "durandal-dashboard")
HERMES_IMG=$(docker compose config --images | grep hermes || echo "durandal-hermes")
NANOCLAW_IMG=$(docker compose config --images | grep nanoclaw || echo "durandal-nanoclaw")

docker save "$DASHBOARD_IMG" | gzip > "$BUILD_DIR/images/dashboard.tar.gz"
docker save "$HERMES_IMG" | gzip > "$BUILD_DIR/images/hermes.tar.gz"
docker save "$NANOCLAW_IMG" | gzip > "$BUILD_DIR/images/nanoclaw.tar.gz"
docker save ollama/ollama:latest | gzip > "$BUILD_DIR/images/ollama.tar.gz"
docker save caddy:2-alpine | gzip > "$BUILD_DIR/images/caddy.tar.gz"

echo "   Images saved: $(du -sh "$BUILD_DIR/images" | cut -f1)"

# Step 3: Download Ollama model
echo "[3/6] Downloading Ollama model ($MODEL)..."
# If Ollama is running locally, copy the model blob
if command -v ollama &> /dev/null; then
  ollama pull "$MODEL" 2>/dev/null || true
  # Find the model files
  OLLAMA_DIR="${OLLAMA_MODELS:-$HOME/.ollama/models}"
  if [ -d "$OLLAMA_DIR" ]; then
    cp -r "$OLLAMA_DIR" "$BUILD_DIR/ollama/models"
    echo "   Model copied: $(du -sh "$BUILD_DIR/ollama/models" | cut -f1)"
  fi
else
  echo "   WARNING: Ollama not installed locally. Model must be pulled after deployment."
  echo "   Install Ollama and run: ollama pull $MODEL"
fi

# Step 4: Copy configuration
echo "[4/6] Copying configuration..."
cp "$PROJECT_DIR/docker/docker-compose.yml" "$BUILD_DIR/config/"
cp "$PROJECT_DIR/docker/docker-compose.prod.yml" "$BUILD_DIR/config/" 2>/dev/null || true
cp "$PROJECT_DIR/docker/Caddyfile" "$BUILD_DIR/config/"
cp "$PROJECT_DIR/docker/.env.example" "$BUILD_DIR/config/"
cp -r "$PROJECT_DIR/docker/Dockerfile."* "$BUILD_DIR/config/" 2>/dev/null || true

# Step 5: Copy templates
echo "[5/6] Copying templates..."
cp "$PROJECT_DIR/templates/"*.yaml "$BUILD_DIR/templates/" 2>/dev/null || true

# Step 6: Create offline installer
echo "[6/6] Creating offline installer..."
# (The install-offline.sh script is created separately)
cp "$PROJECT_DIR/scripts/install-offline.sh" "$BUILD_DIR/install.sh"
chmod +x "$BUILD_DIR/install.sh"

# Create a README for the USB
cat > "$BUILD_DIR/README.txt" << 'USBREADME'
DURANDAL — USB Deployment
=========================

This USB drive contains everything needed to deploy DURANDAL
on any machine with Docker installed. No internet required.

INSTALLATION:
  1. Open a terminal
  2. Navigate to this USB drive
  3. Run: ./install.sh

REQUIREMENTS:
  - Docker 27+ (must be pre-installed)
  - 8GB RAM minimum (16GB recommended)
  - 20GB disk space
  - macOS, Linux, or Windows (WSL2)

WHAT'S INCLUDED:
  - Pre-built Docker images (images/)
  - Ollama LLM model weights (ollama/)
  - Business automation templates (templates/)
  - Configuration files (config/)
  - Offline installer script (install.sh)

After installation, open https://localhost in your browser.
USBREADME

echo ""
echo "USB bundle created at: $BUILD_DIR"
echo "Total size: $(du -sh "$BUILD_DIR" | cut -f1)"
echo ""
echo "Copy this directory to a USB drive:"
echo "  cp -r $BUILD_DIR /Volumes/YOUR_USB/"
