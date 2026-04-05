#!/usr/bin/env bash
set -euo pipefail

MODEL="${OLLAMA_DEFAULT_MODEL:-qwen2.5:7b}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "DURANDAL — Ollama Setup"
echo "======================"
echo ""
echo "Pulling model: $MODEL"
echo "Ollama host: $OLLAMA_HOST"
echo ""

# Wait for Ollama to be ready
for i in $(seq 1 30); do
  if curl -sf "$OLLAMA_HOST/" > /dev/null 2>&1; then
    echo "Ollama is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Error: Ollama not reachable at $OLLAMA_HOST after 60 seconds."
    exit 1
  fi
  echo "Waiting for Ollama... ($i/30)"
  sleep 2
done

# Pull the model
echo ""
echo "Downloading $MODEL (this may take several minutes)..."
curl -sf "$OLLAMA_HOST/api/pull" -d "{\"name\": \"$MODEL\"}" | while IFS= read -r line; do
  status=$(echo "$line" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$status" ]; then
    printf "\r  %s                    " "$status"
  fi
done
echo ""
echo ""
echo "Model $MODEL is ready."
