FROM node:10

RUN git clone https://github.com/axiom-org/axiom.git

WORKDIR /axiom/ts

RUN npm install

RUN node_modules/.bin/tsc --build tsconfig.node.json

ENTRYPOINT ../ops/hserver-entrypoint.sh

# Peer server
EXPOSE 3500
