#!/usr/bin/env bash
# deploy.sh — Build and push @wity/scene-to-video to Replicate
#
# Usage:  ./deployments/replicate/deploy.sh
#         (can be run from any directory)
#
# Requires:
#   REPLICATE_API_TOKEN env var  — your Replicate API token
#   docker                       — for build + push
#   curl, jq                     — for Replicate API calls

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$SCRIPT_DIR/replicate.config.json"

# ── Read config ───────────────────────────────────────────────────────────────

if [ ! -f "$CONFIG" ]; then
  echo "Error: $CONFIG not found" >&2
  exit 1
fi

for cmd in docker curl jq; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

OWNER=$(jq -r '.owner'      "$CONFIG")
MODEL=$(jq -r '.model'      "$CONFIG")
VISIBILITY=$(jq -r '.visibility' "$CONFIG")
HARDWARE=$(jq -r '.hardware'   "$CONFIG")
IMAGE="r8.im/$OWNER/$MODEL"

if [ "$OWNER" = "YOUR_REPLICATE_USERNAME" ]; then
  echo "Error: set 'owner' in replicate.config.json before deploying." >&2
  exit 1
fi

if [ -z "${REPLICATE_API_TOKEN:-}" ]; then
  echo "Error: REPLICATE_API_TOKEN env var is not set." >&2
  echo "       Export it or prefix the command: REPLICATE_API_TOKEN=... ./deploy.sh" >&2
  exit 1
fi

# ── Header ────────────────────────────────────────────────────────────────────

echo "──────────────────────────────────────────────────"
echo "  wity-scene-to-video  →  Replicate"
echo "  Model   : $OWNER/$MODEL  ($VISIBILITY)"
echo "  Hardware: $HARDWARE"
echo "  Image   : $IMAGE"
echo "──────────────────────────────────────────────────"
echo ""

# ── [1/4] Ensure model exists on Replicate ────────────────────────────────────

echo "[1/4] Checking Replicate model..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  "https://api.replicate.com/v1/models/$OWNER/$MODEL")

if [ "$HTTP_STATUS" = "404" ]; then
  echo "    Model not found — creating $OWNER/$MODEL..."
  curl -s -X POST \
    -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"owner\":\"$OWNER\",\"name\":\"$MODEL\",\"visibility\":\"$VISIBILITY\",\"hardware\":\"$HARDWARE\"}" \
    "https://api.replicate.com/v1/models" > /dev/null
  echo "    Model created."
elif [ "$HTTP_STATUS" = "200" ]; then
  echo "    Model exists."
else
  echo "Error: Replicate API returned HTTP $HTTP_STATUS — check your API token and owner name." >&2
  exit 1
fi

# ── [2/4] Docker login ────────────────────────────────────────────────────────

echo "[2/4] Logging in to r8.im..."
echo "$REPLICATE_API_TOKEN" | docker login r8.im -u "$OWNER" --password-stdin

# ── [3/4] Build ───────────────────────────────────────────────────────────────

echo "[3/4] Building image..."
echo "    Context : $REPO_ROOT"
echo "    Tag     : $IMAGE"
echo ""

# --platform linux/amd64 ensures correct binary even on Apple Silicon hosts
docker build \
  --platform linux/amd64 \
  -f "$SCRIPT_DIR/Dockerfile" \
  -t "$IMAGE" \
  "$REPO_ROOT"

# ── [4/4] Push ────────────────────────────────────────────────────────────────

echo ""
echo "[4/4] Pushing to r8.im..."
docker push "$IMAGE"

# ── Fetch new version from Replicate API (poll until it appears) ──────────────

echo ""
echo "Waiting for Replicate to register the new version..."

VERSION=""
for i in $(seq 1 12); do
  VERSION=$(curl -s \
    -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
    "https://api.replicate.com/v1/models/$OWNER/$MODEL/versions" | \
    jq -r '.results[0].id // empty')

  if [ -n "$VERSION" ]; then
    break
  fi
  sleep 5
done

echo ""
echo "Done."
if [ -n "$VERSION" ]; then
  echo "  Model   : https://replicate.com/$OWNER/$MODEL"
  echo "  Version : $VERSION"
else
  echo "  Model   : https://replicate.com/$OWNER/$MODEL"
  echo "  Version : (not yet visible — check https://replicate.com/$OWNER/$MODEL/versions)"
fi
echo ""
