FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner: Playwright image ships Chromium + all required system libs.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Bring over standalone server + static + public (snapshots persist via volume below).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The Playwright image exposes browsers at /ms-playwright; the bundled node_modules
# in the standalone output references playwright but the browsers come from the image.

EXPOSE 3000
CMD ["node", "server.js"]
