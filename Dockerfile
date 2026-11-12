FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git ffmpeg poppler-utils procps ripgrep \
    python3 python3-pip libglib2.0-0 \
    && pip3 install --no-cache-dir --break-system-packages pillow numpy opencv-python-headless yt-dlp \
    && npm install -g @opencode/cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN chmod +x scripts/render-boot.sh

ENV NODE_ENV=production
EXPOSE 10000
CMD ["bash", "scripts/render-boot.sh"]
