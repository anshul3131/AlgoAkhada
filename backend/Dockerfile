# 1. Use an official Node.js runtime as the base image
FROM node:20-alpine

RUN apk add --no-cache g++ python3

# 2. Install the Docker CLI inside this container
# Our Node app needs the actual 'docker' command line tool to talk to the socket!
RUN apk add --no-cache docker-cli bash

# 3. Create the app directory
WORKDIR /usr/src/app

# 4. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your backend application source code
COPY . .

# 7. Expose your API port
EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]