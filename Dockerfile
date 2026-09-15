# syntax=docker/dockerfile:1

# ---- dependências ----------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# a planilha real não entra na imagem (ver .dockerignore) — só o código
RUN npm run build

# ---- runtime -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# a planilha vive fora da imagem, em /app/dados — monte um volume nesse caminho
ENV PLANILHA=/app/dados/torneio.xlsx

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/dados && chown nextjs:nodejs /app/dados

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
