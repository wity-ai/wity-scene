# Dockerfile for Replicate deployment of @wity/scene-to-video
#
# Build context: repo root  (docker build -f deployments/replicate/Dockerfile .)
#
# @napi-rs/canvas ships self-contained Skia binaries — no Cairo/Pango system
# deps required. Only FFmpeg is needed as a system package.

FROM node:20-bullseye-slim

# FFmpeg is the only system dep needed (@napi-rs/canvas bundles its own Skia)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Dependencies (own layer — rebuilt only when packages change) ───────────────

# Copy workspace packages (build context = repo root)
COPY packages/scene-core      ./packages/scene-core
COPY packages/scene-to-video  ./packages/scene-to-video

# Deployment package.json references the workspace packages via file: paths
COPY deployments/replicate/package.json ./package.json

# Install for linux/x64/glibc — matches Replicate's container runtime.
# npm_config_libc=glibc ensures @napi-rs/canvas resolves the gnu binary,
# not the musl variant, even on cross-platform build hosts.
RUN npm_config_libc=glibc npm install \
      --omit=dev \
      --platform=linux \
      --arch=x64

# ── Application ───────────────────────────────────────────────────────────────

COPY deployments/replicate/predict.js ./predict.js

EXPOSE 5000

CMD ["node", "predict.js"]
