FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy application source
COPY . .

# Set default production environment
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000 3500

CMD ["node", "server.js"]
