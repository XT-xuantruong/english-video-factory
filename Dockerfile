FROM node:22-bookworm-slim

RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg chromium ca-certificates fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.json ./
RUN corepack prepare pnpm@10.14.0 --activate \
    && pnpm install --frozen-lockfile=false
COPY . .

ENV TEMPLATES_DIR=/app/templates
ENV ASSETS_DIR=/app/assets
ENTRYPOINT ["pnpm", "evf"]
CMD ["doctor"]
