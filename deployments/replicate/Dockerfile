# Dockerfile for Replicate deployment of @wity/scene-compiler
#
# Builds a Node.js container with:
#   - node-canvas (Cairo native addon, pre-built for this base image)
#   - FFmpeg (system package)
#   - @wity/scene-compiler + @wity/scene-core
#   - A thin HTTP server (predict.js) that implements Replicate's prediction interface
#
# Build: docker build -t wity-scene-compiler .
# Run:   docker run -p 5000:5000 wity-scene-compiler

FROM node:20-bullseye-slim

# Cairo + Pango + FFmpeg system deps (required by node-canvas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package.json ./
COPY ../../packages/scene-core  ./packages/scene-core
COPY ../../packages/scene-compiler ./packages/scene-compiler

RUN npm install

# Copy prediction server
COPY predict.js ./

EXPOSE 5000

CMD ["node", "predict.js"]
