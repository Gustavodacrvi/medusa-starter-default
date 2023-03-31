FROM node:17.1.0

WORKDIR /app/medusa

RUN apt-get update

RUN npm install medusa-plugin-meilisearch

RUN apt-get install -y python

RUN npm install -g npm@8.1.2

RUN npm install -g @medusajs/medusa-cli@latest

COPY package.json .
RUN npm install

COPY . .

ENTRYPOINT ["./develop.sh"]
