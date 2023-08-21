FROM node:12-alpine

RUN apk add tzdata
RUN ln -sf /usr/share/zoneinfo/Asia/Jakarta /etc/localtime

WORKDIR /code

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 7072
CMD [ "node", "index.js" ]