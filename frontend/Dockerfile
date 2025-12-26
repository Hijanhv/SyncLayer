# Build stage
FROM node:20-alpine AS builder

ARG VITE_API_URL=http://localhost:8080

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
