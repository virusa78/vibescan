# VibeScan API image
FROM node:24-alpine

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    git \
    g++ \
    make \
    python3 \
    unzip

RUN addgroup -g 1000 -S nodejs && \
    adduser -S nodejs -u 1000 -G nodejs

USER nodejs
WORKDIR /home/nodejs/app/wasp-app

COPY --chown=nodejs:nodejs wasp-app/package*.json ./
RUN npm ci

RUN curl -sSL https://get.wasp-lang.dev/installer.sh | sh
ENV PATH="/home/nodejs/.wasp/bin:${PATH}"

COPY --chown=nodejs:nodejs wasp-app/ ./
RUN wasp build

ARG PORT=3000
ARG WASP_SERVER_URL=http://127.0.0.1:3000
ARG WASP_WEB_CLIENT_URL=http://127.0.0.1:3000
ENV PORT=${PORT} \
    WASP_SERVER_URL=${WASP_SERVER_URL} \
    WASP_WEB_CLIENT_URL=${WASP_WEB_CLIENT_URL}

EXPOSE 3000

CMD ["node", ".wasp/build/server"]
