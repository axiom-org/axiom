#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run attach.sh from the ops directory"
    exit 1
fi

if [[ ! $1 =~ ^[0-3]$ ]]; then
    echo "usage: ./attach.sh n where n is in 0..3"    
    exit 1
fi

DEPLOYMENT=hserver$1-deployment

PODS=`kubectl get pods`
POD=`echo $PODS | grep $DEPLOYMENT | cut -d" " -f1`

echo pods: $PODS
echo pod: $POD
