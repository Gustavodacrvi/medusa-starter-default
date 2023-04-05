FROM node:18.0.0

WORKDIR /app/medusa

RUN apt-get update

RUN npm install medusa-plugin-meilisearch

RUN apt-get install -y python

RUN npm install -g npm@9.6.3

RUN npm install -g @medusajs/medusa-cli@latest

COPY package.json .
RUN npm install --force

COPY . .

ENTRYPOINT ["./develop.sh"]
