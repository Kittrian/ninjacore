FROM node:22-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

EXPOSE 3100
CMD ["npm", "start"]
