FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /data

ENV PORT=8787
ENV DB_PATH=/data/fuseboard.db

EXPOSE 8787

CMD ["node", "node-entry.js"]
