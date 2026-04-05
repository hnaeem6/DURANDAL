#!/usr/bin/env bash
# ============================================================================
# DURANDAL One-Command Installer
# Usage: curl -fsSL https://durandal.ai/install | sh
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Color helpers (safe for piped / non-TTY output)
# ---------------------------------------------------------------------------
if [ -t 1 ] && command -v tput &>/dev/null; then
  BOLD=$(tput bold)
  GREEN=$(tput setaf 2)
  YELLOW=$(tput setaf 3)
  RED=$(tput setaf 1)
  CYAN=$(tput setaf 6)
  RESET=$(tput sgr0)
else
  BOLD="" GREEN="" YELLOW="" RED="" CYAN="" RESET=""
fi

info()  { printf "%s[INFO]%s  %s\n" "$GREEN"  "$RESET" "$*"; }
warn()  { printf "%s[WARN]%s  %s\n" "$YELLOW" "$RESET" "$*"; }
error() { printf "%s[FAIL]%s  %s\n" "$RED"    "$RESET" "$*"; }
step()  { printf "\n%s==> %s%s\n" "$CYAN$BOLD" "$*" "$RESET"; }

fail() { error "$@"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Banner
# ---------------------------------------------------------------------------
cat <<'BANNER'

 ██████╗ ██╗   ██╗██████╗  █████╗ ███╗   ██╗██████╗  █████╗ ██╗
 ██╔══██╗██║   ██║██╔══██╗██╔══██╗████╗  ██║██╔══██╗██╔══██╗██║
 ██║  ██║██║   ██║██████╔╝███████║██╔██╗ ██║██║  ██║███████║██║
 ██║  ██║██║   ██║██╔══██╗██╔══██║██║╚██╗██║██║  ██║██╔══██║██║
 ██████╔╝╚██████╔╝██║  ██║██║  ██║██║ ╚████║██████╔╝██║  ██║███████╗
 ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚══════╝

  Your unbreakable AI workforce. Runs local. Stays private. Gets smarter.

BANNER

# ---------------------------------------------------------------------------
# 2. Detect platform
# ---------------------------------------------------------------------------
step "Detecting platform"

OS="$(uname -s)"
ARCH="$(uname -m)"
PLATFORM=""

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)  PLATFORM="macOS-arm64"  ;;
      x86_64) PLATFORM="macOS-x86_64" ;;
      *)      fail "Unsupported macOS architecture: $ARCH" ;;
    esac
    ;;
  Linux)
    # Detect WSL
    if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
      PLATFORM="WSL"
    else
      case "$ARCH" in
        x86_64)  PLATFORM="Linux-amd64" ;;
        aarch64) PLATFORM="Linux-arm64" ;;
        *)       fail "Unsupported Linux architecture: $ARCH" ;;
      esac
    fi
    ;;
  *)
    fail "Unsupported operating system: $OS. Please use macOS, Linux, or WSL."
    ;;
esac

info "Platform: $PLATFORM"

# ---------------------------------------------------------------------------
# 3. Check prerequisites
# ---------------------------------------------------------------------------
step "Checking prerequisites"

# Docker
if command -v docker &>/dev/null; then
  DOCKER_VERSION="$(docker --version 2>/dev/null || echo 'unknown')"
  info "Docker found: $DOCKER_VERSION"
else
  error "Docker is not installed."
  echo ""
  echo "  Install Docker Desktop:"
  echo "    macOS:  https://docs.docker.com/desktop/install/mac-install/"
  echo "    Linux:  https://docs.docker.com/engine/install/"
  echo "    WSL:    https://docs.docker.com/desktop/install/windows-install/"
  echo ""
  fail "Please install Docker and re-run this installer."
fi

# Docker Compose (v2 plugin or standalone)
if docker compose version &>/dev/null; then
  COMPOSE_VERSION="$(docker compose version --short 2>/dev/null || echo 'unknown')"
  info "Docker Compose found: $COMPOSE_VERSION"
elif command -v docker-compose &>/dev/null; then
  warn "Found legacy docker-compose. Docker Compose v2 is recommended."
else
  error "Docker Compose is not installed."
  echo ""
  echo "  Docker Compose v2 ships with Docker Desktop."
  echo "  For standalone install: https://docs.docker.com/compose/install/"
  echo ""
  fail "Please install Docker Compose and re-run this installer."
fi

# Docker daemon running
if ! docker info &>/dev/null 2>&1; then
  fail "Docker daemon is not running. Please start Docker Desktop and re-run."
fi

# RAM check
RAM_MB=0
if [ "$OS" = "Darwin" ]; then
  RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  RAM_MB=$((RAM_BYTES / 1024 / 1024))
elif [ "$OS" = "Linux" ]; then
  RAM_KB="$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)"
  RAM_MB=$((RAM_KB / 1024))
fi

if [ "$RAM_MB" -gt 0 ]; then
  RAM_GB=$((RAM_MB / 1024))
  if [ "$RAM_MB" -lt 8192 ]; then
    warn "System RAM: ${RAM_GB}GB. DURANDAL recommends >= 8GB for local LLMs."
    warn "You may experience slow performance with large models."
  else
    info "System RAM: ${RAM_GB}GB (OK)"
  fi
else
  warn "Could not determine system RAM."
fi

# Disk space check
INSTALL_DIR="${DURANDAL_INSTALL_DIR:-$HOME/durandal}"
PARENT_DIR="$(dirname "$INSTALL_DIR")"
if [ ! -d "$PARENT_DIR" ]; then
  PARENT_DIR="$HOME"
fi

DISK_FREE_KB=0
if command -v df &>/dev/null; then
  DISK_FREE_KB="$(df -k "$PARENT_DIR" 2>/dev/null | tail -1 | awk '{print $4}')"
fi
DISK_FREE_GB=$((DISK_FREE_KB / 1024 / 1024))

if [ "$DISK_FREE_KB" -gt 0 ] 2>/dev/null; then
  if [ "$DISK_FREE_KB" -lt 10485760 ]; then  # 10GB in KB
    fail "Insufficient disk space: ${DISK_FREE_GB}GB free. DURANDAL requires at least 10GB."
  else
    info "Free disk: ${DISK_FREE_GB}GB (OK)"
  fi
else
  warn "Could not determine free disk space."
fi

# ---------------------------------------------------------------------------
# 4. Clone or update the repository
# ---------------------------------------------------------------------------
step "Setting up DURANDAL"

REPO_URL="${DURANDAL_REPO:-https://github.com/durandal-ai/durandal.git}"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Existing installation found at $INSTALL_DIR"
  info "Pulling latest changes..."
  git -C "$INSTALL_DIR" pull --ff-only || {
    warn "Could not fast-forward. Continuing with existing code."
  }
elif [ -d "$INSTALL_DIR" ]; then
  info "Directory $INSTALL_DIR exists (not a git repo). Using as-is."
else
  info "Cloning DURANDAL to $INSTALL_DIR..."
  if command -v git &>/dev/null; then
    git clone "$REPO_URL" "$INSTALL_DIR"
  else
    fail "git is not installed. Please install git and re-run."
  fi
fi

cd "$INSTALL_DIR"
info "Working directory: $INSTALL_DIR"

# ---------------------------------------------------------------------------
# 5. Generate secrets / .env
# ---------------------------------------------------------------------------
step "Configuring environment"

ENV_FILE="$INSTALL_DIR/docker/.env"
ENV_EXAMPLE="$INSTALL_DIR/docker/.env.example"

generate_secret() {
  # Produce a URL-safe random string (works on both macOS and Linux)
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 | tr -d '/+=' | head -c 40
  elif [ -r /dev/urandom ]; then
    head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40
  else
    # Fallback: date-based (not cryptographically strong, but functional)
    date +%s%N | sha256sum | head -c 40
  fi
}

if [ -f "$ENV_FILE" ]; then
  info ".env already exists. Preserving existing configuration."
else
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    warn ".env.example not found. Creating minimal .env"
    cat > "$ENV_FILE" <<EOF
# DURANDAL Environment Configuration (auto-generated)
NEXTAUTH_SECRET=
DURANDAL_API_TOKEN=
OLLAMA_DEFAULT_MODEL=qwen2.5:7b
EOF
  fi

  # Inject generated secrets
  NEXTAUTH_SECRET="$(generate_secret)"
  DURANDAL_API_TOKEN="drnl_$(generate_secret)"

  if [ "$OS" = "Darwin" ]; then
    sed -i '' "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" "$ENV_FILE"
  else
    sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" "$ENV_FILE"
  fi

  # Add DURANDAL_API_TOKEN if not present, or update it
  if grep -q '^DURANDAL_API_TOKEN=' "$ENV_FILE"; then
    if [ "$OS" = "Darwin" ]; then
      sed -i '' "s|^DURANDAL_API_TOKEN=.*|DURANDAL_API_TOKEN=${DURANDAL_API_TOKEN}|" "$ENV_FILE"
    else
      sed -i "s|^DURANDAL_API_TOKEN=.*|DURANDAL_API_TOKEN=${DURANDAL_API_TOKEN}|" "$ENV_FILE"
    fi
  else
    echo "DURANDAL_API_TOKEN=${DURANDAL_API_TOKEN}" >> "$ENV_FILE"
  fi

  info "Generated secrets and wrote $ENV_FILE"
fi

# ---------------------------------------------------------------------------
# 6. Build Docker images
# ---------------------------------------------------------------------------
step "Building Docker images"

docker compose -f "$INSTALL_DIR/docker/docker-compose.yml" build || {
  fail "Docker build failed. Check the output above for errors."
}
info "Docker images built successfully."

# ---------------------------------------------------------------------------
# 7. Check / install Ollama
# ---------------------------------------------------------------------------
step "Checking Ollama"

if command -v ollama &>/dev/null; then
  OLLAMA_VERSION="$(ollama --version 2>/dev/null || echo 'unknown')"
  info "Ollama found: $OLLAMA_VERSION"
else
  info "Ollama not found. Installing..."
  if curl -fsSL https://ollama.com/install.sh | sh; then
    info "Ollama installed successfully."
  else
    warn "Ollama auto-install failed. DURANDAL will use the containerized Ollama instead."
    warn "For GPU acceleration, install Ollama manually: https://ollama.com/download"
  fi
fi

# ---------------------------------------------------------------------------
# 8. Pull default model
# ---------------------------------------------------------------------------
step "Pulling default AI model"

SETUP_OLLAMA="$INSTALL_DIR/scripts/setup-ollama.sh"
if [ -f "$SETUP_OLLAMA" ]; then
  # Source .env for OLLAMA_DEFAULT_MODEL if set
  if [ -f "$ENV_FILE" ]; then
    export OLLAMA_DEFAULT_MODEL="$(grep '^OLLAMA_DEFAULT_MODEL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo 'qwen2.5:7b')"
  fi
  bash "$SETUP_OLLAMA" || {
    warn "Model pull had issues. You can pull it later with: ollama pull qwen2.5:7b"
  }
else
  warn "setup-ollama.sh not found. Skipping model pull."
fi

# ---------------------------------------------------------------------------
# 9. Start services
# ---------------------------------------------------------------------------
step "Starting DURANDAL services"

docker compose -f "$INSTALL_DIR/docker/docker-compose.yml" up -d || {
  fail "Failed to start services. Run 'docker compose logs' for details."
}
info "Services started."

# ---------------------------------------------------------------------------
# 10. Health check
# ---------------------------------------------------------------------------
step "Waiting for services to become healthy"

HEALTH_URL="https://localhost/api/health"
MAX_WAIT=60
WAITED=0

while [ "$WAITED" -lt "$MAX_WAIT" ]; do
  # Use -k to accept self-signed cert from Caddy
  if curl -ksfS "$HEALTH_URL" > /dev/null 2>&1; then
    info "Health check passed!"
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  printf "\r  Waiting for health... (%ds / %ds)" "$WAITED" "$MAX_WAIT"
done
echo ""

if [ "$WAITED" -ge "$MAX_WAIT" ]; then
  warn "Health check did not pass within ${MAX_WAIT}s."
  warn "Services may still be starting. Check status with:"
  warn "  cd $INSTALL_DIR && bash scripts/durandal.sh status"
fi

# ---------------------------------------------------------------------------
# 11. Success message
# ---------------------------------------------------------------------------
echo ""
echo "${GREEN}${BOLD}============================================${RESET}"
echo "${GREEN}${BOLD}  DURANDAL is installed and running!${RESET}"
echo "${GREEN}${BOLD}============================================${RESET}"
echo ""
echo "  ${CYAN}Dashboard:${RESET}   https://localhost"
echo "  ${CYAN}API:${RESET}         https://localhost/api"
echo "  ${CYAN}Install dir:${RESET} $INSTALL_DIR"
echo ""
echo "  ${BOLD}Quick commands:${RESET}"
echo "    bash scripts/durandal.sh status    # Check service status"
echo "    bash scripts/durandal.sh logs      # View live logs"
echo "    bash scripts/durandal.sh stop      # Stop services"
echo "    bash scripts/durandal.sh backup    # Create backup"
echo ""
echo "  ${BOLD}Next steps:${RESET}"
echo "    1. Open ${CYAN}https://localhost${RESET} in your browser"
echo "    2. Accept the self-signed certificate warning"
echo "    3. Create your first AI agent from the dashboard"
echo ""
echo "  ${YELLOW}Note:${RESET} Your browser may warn about the self-signed TLS certificate."
echo "  This is normal for local installations."
echo ""
