# Playwright image includes Chromium + all OS deps
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package*.json ./
# Skip browser download — the base image already has Chromium at /ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
