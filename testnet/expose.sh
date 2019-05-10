#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run expose.sh from the testnet directory"
    exit 1
fi

if [[ ! "$1" =~ [0-3] ]]; then
    echo "usage: ./expose.sh n where n is in 0..3"
    exit 1
fi

SERVICE=cservice$1
SERVER=cserver$1

sed "s/cserviceX/$SERVICE/g" ./service.yaml \
    | sed "s/cserverX/$SERVER/g" \
    | kubectl apply -f -
