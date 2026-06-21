#!/usr/bin/env bash
# deploy.sh — Build and deploy @wity/scene-to-video to AWS Lambda
#
# Usage:  ./deployments/lambda/deploy.sh
#         (can be run from any directory)
#
# Requires: aws-cli (profile: lambda-devops), jq, node, npm

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$SCRIPT_DIR/lambda.config.json"
DIST_DIR="$SCRIPT_DIR/dist"
BUILD_DIR="$DIST_DIR/build"

# ── Read config ───────────────────────────────────────────────────────────────

if [ ! -f "$CONFIG" ]; then
  echo "Error: $CONFIG not found" >&2
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required. Install: apt-get install jq" >&2
  exit 1
fi

FUNCTION_NAME=$(jq -r '.functionName'          "$CONFIG")
REGION=$(jq -r '.region'                       "$CONFIG")
RUNTIME=$(jq -r '.runtime'                     "$CONFIG")
HANDLER=$(jq -r '.handler'                     "$CONFIG")
ARCHITECTURE=$(jq -r '.architecture'           "$CONFIG")
MEMORY_SIZE=$(jq -r '.memorySize'              "$CONFIG")
TIMEOUT=$(jq -r '.timeout'                     "$CONFIG")
EPHEMERAL_STORAGE=$(jq -r '.ephemeralStorage'  "$CONFIG")
LAMBDA_ROLE=$(jq -r '.role'                    "$CONFIG")
OUTPUT_BUCKET=$(jq -r '.environment.OUTPUT_BUCKET' "$CONFIG")
OUTPUT_PREFIX=$(jq -r '.environment.OUTPUT_PREFIX' "$CONFIG")

mapfile -t _LAYERS < <(jq -r '.layers[]' "$CONFIG")
LAYER_FLAGS=()
[[ ${#_LAYERS[@]} -gt 0 ]] && LAYER_FLAGS=(--layers "${_LAYERS[@]}")

AWS="aws --profile lambda-devops"
PACKAGE="$DIST_DIR/${FUNCTION_NAME}-package.zip"

# ── Header ────────────────────────────────────────────────────────────────────

echo "──────────────────────────────────────────────────"
echo "  wity-scene-to-video  →  AWS Lambda"
echo "  Function  : $FUNCTION_NAME"
echo "  Region    : $REGION"
echo "  Runtime   : $RUNTIME ($ARCHITECTURE)"
echo "  Memory    : ${MEMORY_SIZE} MB   Timeout: ${TIMEOUT}s"
echo "  /tmp      : ${EPHEMERAL_STORAGE} MB"
echo "  Layers    : ${#_LAYERS[@]}"
echo "──────────────────────────────────────────────────"
echo ""

# ── AWS auth check ────────────────────────────────────────────────────────────

if ! $AWS sts get-caller-identity > /dev/null 2>&1; then
  echo "Error: AWS credentials not configured." >&2
  echo "       Run: aws configure --profile lambda-devops" >&2
  exit 1
fi

# ── [1/4] Stage ───────────────────────────────────────────────────────────────

echo "[1/4] Staging workspace packages..."

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy workspace packages as local deps (strip dev artifacts)
cp -r "$REPO_ROOT/packages/scene-core"     "$BUILD_DIR/_scene-core"
cp -r "$REPO_ROOT/packages/scene-to-video" "$BUILD_DIR/_scene-to-video"
rm -rf \
  "$BUILD_DIR/_scene-core/node_modules" \
  "$BUILD_DIR/_scene-to-video/node_modules" \
  "$BUILD_DIR/_scene-to-video/test" \
  "$BUILD_DIR/_scene-core/dist"          # dist rebuilt from source during install

# Copy the lambda handler
cp "$SCRIPT_DIR/handler.js" "$BUILD_DIR/handler.js"

# Self-contained package.json — workspace * refs replaced with file: paths
S3_SDK_VERSION=$(jq -r '.dependencies["@aws-sdk/client-s3"]' "$SCRIPT_DIR/package.json")
cat > "$BUILD_DIR/package.json" << EOF
{
  "name": "wity-scene-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@wity/scene-core":     "file:./_scene-core",
    "@wity/scene-to-video": "file:./_scene-to-video",
    "@aws-sdk/client-s3":   "$S3_SDK_VERSION"
  }
}
EOF

# ── [2/4] Install ─────────────────────────────────────────────────────────────

echo "[2/4] Installing dependencies for linux/x64 (glibc)..."

# npm_config_libc ensures @napi-rs/canvas resolves the linux-x64-gnu
# pre-built binary (Amazon Linux 2 / glibc) rather than musl.
npm_config_libc=glibc npm install \
  --prefix "$BUILD_DIR" \
  --omit=dev \
  --platform=linux \
  --arch=x64 \
  --silent

# ── [3/4] Package ─────────────────────────────────────────────────────────────

echo "[3/4] Building deployment package..."

mkdir -p "$DIST_DIR"
rm -f "$PACKAGE"

(
  cd "$BUILD_DIR"
  zip -qr "$PACKAGE" . \
    --exclude "*.git*"         \
    --exclude "*/test/*"       \
    --exclude "*/.github/*"    \
    --exclude "*.map"          \
    --exclude "*.md"           \
    --exclude "*.ts"
)

PACKAGE_SIZE=$(du -h "$PACKAGE" | cut -f1)
echo "    → $PACKAGE  ($PACKAGE_SIZE)"

# ── [4/4] Deploy ──────────────────────────────────────────────────────────────

echo "[4/4] Deploying..."

ENV_VARS="Variables={OUTPUT_BUCKET=${OUTPUT_BUCKET},OUTPUT_PREFIX=${OUTPUT_PREFIX}}"

if $AWS lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" > /dev/null 2>&1; then

  echo "    Updating function code..."
  $AWS lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file      "fileb://$PACKAGE" \
    --region        "$REGION" \
    > /dev/null

  $AWS lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --region        "$REGION"

  echo "    Updating function configuration..."
  $AWS lambda update-function-configuration \
    --function-name    "$FUNCTION_NAME" \
    --memory-size      "$MEMORY_SIZE" \
    --timeout          "$TIMEOUT" \
    --ephemeral-storage "Size=$EPHEMERAL_STORAGE" \
    --environment      "$ENV_VARS" \
    "${LAYER_FLAGS[@]}" \
    --region           "$REGION" \
    > /dev/null

else

  echo "    Creating new function..."
  $AWS lambda create-function \
    --function-name  "$FUNCTION_NAME" \
    --runtime        "$RUNTIME" \
    --role           "$LAMBDA_ROLE" \
    --handler        "$HANDLER" \
    --architectures  "$ARCHITECTURE" \
    --zip-file       "fileb://$PACKAGE" \
    --memory-size    "$MEMORY_SIZE" \
    --timeout        "$TIMEOUT" \
    --ephemeral-storage "Size=$EPHEMERAL_STORAGE" \
    --environment    "$ENV_VARS" \
    "${LAYER_FLAGS[@]}" \
    --region         "$REGION" \
    > /dev/null

fi

$AWS lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region        "$REGION"

FUNCTION_ARN=$(
  $AWS lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region        "$REGION" \
    --query         'Configuration.FunctionArn' \
    --output        text
)

echo ""
echo "Done."
echo "  ARN : $FUNCTION_ARN"
echo ""
