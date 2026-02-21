FROM node:20-slim

RUN apt-get update && apt-get install -y git wget unzip && rm -rf /var/lib/apt/lists/*

RUN wget -q https://github.com/github/codeql-cli-binaries/releases/download/v2.24.2/codeql-linux64.zip \
    && unzip -q codeql-linux64.zip -d /opt \
    && rm codeql-linux64.zip \
    && ln -s /opt/codeql/codeql /usr/local/bin/codeql

RUN codeql pack download \
    codeql/javascript-queries \
    codeql/python-queries \
    codeql/java-queries \
    codeql/go-queries \
    codeql/ruby-queries

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
