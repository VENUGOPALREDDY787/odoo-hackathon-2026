FROM node:20-alpine

# docker cli needed to run `docker compose up --scale ...`
RUN apk add --no-cache docker-cli docker-cli-compose

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY autoscaler.js ./

ENV NODE_ENV=production
CMD ["node", "autoscaler.js"]
