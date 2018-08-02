FROM node:10-alpine

EXPOSE 3001

RUN apk update && apk upgrade && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache \
      chromium@edge \
      nss@edge

ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN addgroup -S puppeteer && adduser -S -g puppeteer puppeteer \
    && mkdir -p /home/puppeteer/Downloads \
    && chown -R puppeteer:puppeteer /home/puppeteer

USER puppeteer

WORKDIR /home/puppeteer
COPY package.json package.json
COPY src src

RUN yarn
RUN yarn build

ENTRYPOINT ["dumb-init", "--"]

CMD node lib/worker
