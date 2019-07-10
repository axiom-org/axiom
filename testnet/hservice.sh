#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run hservice.sh from the testnet directory"
    exit 1
fi

if [[ ! "$1" =~ [0-3] ]]; then
    echo "usage: ./hservice.sh n where n is in 0..3"
    exit 1
fi

SERVICE=hservice$1
CSERVER=cserver$1
HSERVER=hserver$1
INGRESS=hingress$1

cat ./service.yaml \
    | sed "s/hserviceX/$SERVICE/g" \
    | sed "s/cserverX/$CSERVER/g" \
    | sed "s/hserverX/$HSERVER/g" \
    | sed "s/hingressX/$HINGRESS/g" \
    | kubectl apply -f -
