FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Prisma config requires DATABASE_URL/DIRECT_URL even for client generation during image build.
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/krows_ci?schema=public
ARG DIRECT_URL=postgresql://postgres:postgres@localhost:5432/krows_ci?schema=public
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}

COPY package*.json ./
COPY shared-types ./shared-types
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN npm install -g pm2@7

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/shared-types ./shared-types
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY ecosystem.config.js ./

EXPOSE 6769
# Migration needs a direct (non-pooled) connection — Prisma uses DIRECT_URL automatically
# for `migrate deploy` when the schema defines a datasource `directUrl`. Runs once here,
# before pm2-runtime forks the cluster workers (not per-worker).
CMD ["sh", "-c", "npx prisma migrate deploy && pm2-runtime start ecosystem.config.js"]
