FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV OPS_DATA_FILE=/data/ops.json

COPY package.json package-lock.json ./
COPY src ./src
COPY ops ./ops

RUN mkdir -p /data && chown -R node:node /app /data

USER node
EXPOSE 8787

CMD ["npm", "run", "ops:start"]
