#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run hservice.sh from the testnet directory"
    exit 1
fi

if [[ ! "$1" =~ [0-3] ]]; then
    echo "usage: ./hservice.sh n where n is in 0..3"
    exit 1
fi

HSERVICE=hservice$1
CSERVER=cserver$1
HINGRESS=hingress$1

cat ./hservice.yaml \
    | sed "s/hserviceX/$HSERVICE/g" \
    | sed "s/cserverX/$CSERVER/g" \
    | sed "s/hingressX/$HINGRESS/g" \
    | kubectl apply -f -
