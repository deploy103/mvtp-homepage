FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8007
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server.js ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node data/content-defaults.json ./data/content-defaults.json
COPY --chown=node:node public ./public
RUN mkdir -p /app/data /app/public/uploads && chown -R node:node /app
USER node
EXPOSE 8007
CMD ["node", "server.js"]
