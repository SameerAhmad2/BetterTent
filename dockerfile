# Playwright image includes Chromium + all OS deps
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
# Render routes traffic via $PORT; EXPOSE is optional but fine
EXPOSE 10000

CMD ["npm", "start"]
