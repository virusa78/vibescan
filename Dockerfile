# VibeScan Dockerfile
FROM node:24-alpine

# Create app directory
WORKDIR /app

# Install build/runtime dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash \
    curl \
    git \
    unzip \
    ca-certificates

# Install scanner toolchain used by workers
ARG GRYPE_VERSION=v0.79.6
ARG SYFT_VERSION=v1.23.1
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64) bin_arch="amd64" ;; \
      aarch64) bin_arch="arm64" ;; \
      *) echo "Unsupported architecture: $arch" && exit 1 ;; \
    esac; \
    curl -sSfL "https://github.com/anchore/grype/releases/download/${GRYPE_VERSION}/grype_${GRYPE_VERSION#v}_linux_${bin_arch}.tar.gz" -o /tmp/grype.tgz; \
    tar -xzf /tmp/grype.tgz -C /tmp; \
    mv /tmp/grype /usr/local/bin/grype; \
    chmod +x /usr/local/bin/grype; \
    curl -sSfL "https://github.com/anchore/syft/releases/download/${SYFT_VERSION}/syft_${SYFT_VERSION#v}_linux_${bin_arch}.tar.gz" -o /tmp/syft.tgz; \
    tar -xzf /tmp/syft.tgz -C /tmp; \
    mv /tmp/syft /usr/local/bin/syft; \
    chmod +x /usr/local/bin/syft; \
    rm -f /tmp/grype.tgz /tmp/syft.tgz

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript)
RUN npm install

# Copy tsconfig files
COPY tsconfig*.json ./

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Start the application
CMD ["npm", "start"]
