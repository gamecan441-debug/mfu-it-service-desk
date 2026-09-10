# =============================================================
# University IT Service Request Prototype - Dockerfile
# Based on official lightweight Node.js 22 Alpine
# =============================================================
FROM node:22-alpine

# Set working directory inside container
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/itservice.db

# Create persistent data directory for SQLite
RUN mkdir -p /app/data

# Copy project files
COPY package.json ./
COPY schema.sql ./
COPY db.js ./
COPY server.js ./
COPY public ./public

# Expose web service port
EXPOSE 3000

# Start server (auto-initializes database if not present)
CMD ["node", "server.js"]

