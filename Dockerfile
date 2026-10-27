# ==============================================================================
# Automated Website Availability Monitoring on AWS - Docker Container
# Multi-runtime image (Node.js 20 + Python 3 + boto3 for local AWS simulation)
# ==============================================================================

FROM node:20-alpine

# Set metadata
LABEL maintainer="Cloud Computing Lab Practical"
LABEL description="Automated Website Availability Monitoring on AWS with Live Dashboard and Simulation Engine"

# Install Python 3, pip, and curl (for healthchecks and local Lambda parity execution)
RUN apk add --no-cache python3 py3-pip curl && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir boto3

# Ensure virtualenv python and tools are in PATH
ENV PATH="/opt/venv/bin:$PATH"
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory in container
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY server/package*.json ./server/

# Install Node dependencies
WORKDIR /app/server
RUN npm ci --omit=dev

# Copy application source code
WORKDIR /app
COPY server ./server
COPY public ./public
COPY aws ./aws

# Expose Web Dashboard & REST API port
EXPOSE 3000

# Docker healthcheck checking availability of server
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/targets || exit 1

# Start the application server
WORKDIR /app/server
CMD ["node", "server.js"]
