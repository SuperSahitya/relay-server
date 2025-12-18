FROM node:22.17.1-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Production stage
FROM node:22.17.1-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile  --ignore-scripts && pnpm store prune

COPY --from=builder /app/dist ./dist

RUN chown -R app:app /app

USER app

EXPOSE 5000

CMD ["node", "dist/index.js"]