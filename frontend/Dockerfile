# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /src
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /src
COPY --from=deps /src/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /src/public ./public
COPY --from=builder /src/.next/standalone ./
COPY --from=builder /src/.next/static ./.next/static

EXPOSE 3000
ENTRYPOINT ["node", "server.js"]
