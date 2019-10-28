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

POD=`kubectl get pods | grep $DEPLOYMENT | cut -d" " -f1`

if [ "$POD" = "" ]; then
    echo pod $1 not found. current pods:
    kubectl get pods
    exit 1
fi

echo found pod: $POD

kubectl exec -it $POD -- /bin/bash
