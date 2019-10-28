#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run deploy.sh from the ops directory"
    exit 1
fi

if [ "$1" = "all" ]; then
    for x in `seq 0 3`; do
	echo ./deploy.sh $x
	./deploy.sh $x || exit 1
    done
    echo kubectl get pods
    kubectl get pods
    exit 0
fi

if [[ ! $1 =~ ^[0-3]$ ]]; then
    echo "usage: ./deploy.sh n where n is in 0..3"    
    exit 1
fi

DEPLOYMENT=hserver$1-deployment
HSERVER=hserver$1
VOLUME=volume$1
CLAIM=claim$1

kubectl delete deployment $DEPLOYMENT > /dev/null 2>&1

sed s/PROJECT_ID/$PROJECT_ID/g ./deployment.yaml \
    | sed "s/hserverX/$HSERVER/g" \
    | sed "s/claimX/$CLAIM/g" \
    | sed "s/volumeX/$VOLUME/g" \
    | sed "s/DEPLOY_TIME/`date`/" \
    | kubectl apply -f -

echo waiting for $DEPLOYMENT to be available...
kubectl wait --for=condition=available --timeout=5m deployment/$DEPLOYMENT

if [ $? -ne 0 ]; then
    echo the deploy seems to have failed
    exit 1
fi
