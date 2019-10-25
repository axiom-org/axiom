FROM node:10

RUN npm install -g axiom-cli@latest

ADD entry.sh /

EXPOSE 3500

ENTRYPOINT /entry.sh

