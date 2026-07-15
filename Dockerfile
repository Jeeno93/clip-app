FROM node:22-alpine

WORKDIR /app

COPY artifacts/clip-app-api/package.json ./
COPY artifacts/clip-app-api/tsconfig.json ./

RUN npm install

COPY artifacts/clip-app-api/src ./src

RUN npm run build

EXPOSE 80

CMD ["node", "dist/index.js"]
