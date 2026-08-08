FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV OPS_DATA_FILE=/data/ops.json

COPY package.json package-lock.json ./
COPY src ./src
COPY ops ./ops

RUN apk add --no-cache su-exec \
  && mkdir -p /data \
  && chown -R node:node /app /data

EXPOSE 8787

CMD ["sh", "-c", "chown -R node:node /data && exec su-exec node npm run ops:start"]
