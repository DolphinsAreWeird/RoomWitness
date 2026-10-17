FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# next.config.js's rewrites() reads process.env.BACKEND_URL at build time (baked
# into the compiled routes manifest, not re-read per request) — must be a build arg,
# not just a runtime ECS env var, or the proxy destination silently stays the dev default.
ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
