#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run hservice.sh from the ops directory"
    exit 1
fi

if [[ ! "$1" =~ [0-3] ]]; then
    echo "usage: ./hservice.sh n where n is in 0..3"
    exit 1
fi

HSERVICE=hservice$1
HINGRESS=hingress$1
DOMAIN=$1.axiombootstrap.com
CERT=$HINGRESS-cert
IP=$HINGRESS-ip

cat ./hservice.yaml \
    | sed "s/hserviceX/$HSERVICE/g" \
    | sed "s/hingressX/$HINGRESS/g" \
    | sed "s/domainX/$DOMAIN/g" \
    | sed "s/certX/$CERT/g" \
    | sed "s/ipX/$IP/g" \
    | kubectl apply -f -
