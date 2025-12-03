FROM node:22-alpine AS base

WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN chown -R node:node /app
USER node

# Development stage
FROM base AS development
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm run build
