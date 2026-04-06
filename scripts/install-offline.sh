#!/usr/bin/env bash
set -euo pipefail

# DURANDAL Offline Installer
# Run from USB drive — no internet required

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="${DURANDAL_INSTALL_DIR:-$HOME/durandal}"

echo "╔══════════════════════════════════════╗"
echo "║   DURANDAL Offline Installer         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed."
  echo "Please install Docker first: https://docker.com"
  exit 1
fi

if ! docker info &> /dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Start Docker and try again."
  exit 1
fi

echo "Installing to: $INSTALL_DIR"
echo ""

# Step 1: Load Docker images
echo "[1/5] Loading Docker images (this takes a few minutes)..."
for img in "$SCRIPT_DIR/images/"*.tar.gz; do
  name=$(basename "$img" .tar.gz)
  printf "  Loading %s... " "$name"
  docker load < "$img" > /dev/null 2>&1
  echo "done"
done

# Step 2: Set up installation directory
echo "[2/5] Setting up installation directory..."
mkdir -p "$INSTALL_DIR"/{docker,templates,data}

# Copy compose files and config
cp "$SCRIPT_DIR/config/docker-compose.yml" "$INSTALL_DIR/docker/"
cp "$SCRIPT_DIR/config/docker-compose.prod.yml" "$INSTALL_DIR/docker/" 2>/dev/null || true
cp "$SCRIPT_DIR/config/Caddyfile" "$INSTALL_DIR/docker/"

# Copy templates
cp "$SCRIPT_DIR/templates/"*.yaml "$INSTALL_DIR/templates/" 2>/dev/null || true

# Step 3: Generate secrets
echo "[3/5] Generating security keys..."
ENV_FILE="$INSTALL_DIR/docker/.env"
if [ ! -f "$ENV_FILE" ]; then
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  API_TOKEN=$(openssl rand -hex 32)

  cat > "$ENV_FILE" << ENVEOF
# DURANDAL Configuration (auto-generated)
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
DURANDAL_API_TOKEN=$API_TOKEN
OLLAMA_DEFAULT_MODEL=qwen2.5:7b
DURANDAL_TELEMETRY_ENABLED=false
ENVEOF
  echo "  Security keys generated."
else
  echo "  Using existing .env file."
fi

# Step 4: Load Ollama model weights
echo "[4/5] Loading AI model..."
if [ -d "$SCRIPT_DIR/ollama/models" ]; then
  # Create Ollama data volume and copy model
  docker volume create durandal-ollama-models 2>/dev/null || true

  # Use a temporary container to copy model files into the volume
  docker run --rm \
    -v durandal-ollama-models:/root/.ollama/models \
    -v "$SCRIPT_DIR/ollama/models:/src/models:ro" \
    alpine sh -c "cp -r /src/models/* /root/.ollama/models/ 2>/dev/null || true"

  echo "  Model loaded from USB."
else
  echo "  WARNING: No model found on USB. You'll need internet to pull one."
  echo "  After starting, run: docker exec durandal-ollama-1 ollama pull qwen2.5:7b"
fi

# Step 5: Start services
echo "[5/5] Starting DURANDAL..."
cd "$INSTALL_DIR/docker"
docker compose up -d

# Wait for health
echo ""
echo "Waiting for services to start..."
for i in $(seq 1 30); do
  if curl -sfk https://localhost/api/health > /dev/null 2>&1; then
    echo ""
    echo "╔══════════════════════════════════════╗"
    echo "║   DURANDAL is ready!                 ║"
    echo "╚══════════════════════════════════════╝"
    echo ""
    echo "  Dashboard: https://localhost"
    echo "  Installed: $INSTALL_DIR"
    echo ""
    echo "  First time? Create your admin account at the setup wizard."
    echo ""
    echo "  Commands:"
    echo "    cd $INSTALL_DIR/docker"
    echo "    docker compose logs -f    # View logs"
    echo "    docker compose down       # Stop"
    echo "    docker compose up -d      # Start"
    echo ""
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "Services are starting but not yet healthy."
echo "Check status: cd $INSTALL_DIR/docker && docker compose ps"
echo "View logs: docker compose logs -f"
