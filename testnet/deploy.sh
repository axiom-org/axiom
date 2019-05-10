#!/bin/bash

if [ ! -f ./deployment.yaml ]; then
    echo "please run deploy.sh from the testnet directory"
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

if (( "$1" < 0 )) || (( "$1" > 3 )); then
    echo "usage: ./deploy.sh n where n is in 0..3"
    exit 1
fi

CSERVER=cserver$1
DEPLOYMENT=cserver$1-deployment
HSERVER=hserver$1
DB=db$1
KEYPAIR=keypair$1
VOLUME=volume$1
CLAIM=claim$1

CONNECTION_NAME=`gcloud sql instances describe $DB | grep connectionName | sed 's/connectionName: //'`

if [ -z "$CONNECTION_NAME" ]; then
    echo "could not find sql connection name"
    exit 1
fi

# echo sql connection name: $CONNECTION_NAME

kubectl delete deployment $DEPLOYMENT > /dev/null 2>&1

sed s/PROJECT_ID/$PROJECT_ID/g ./deployment.yaml \
    | sed "s/cserverX/$CSERVER/g" \
    | sed "s/hserverX/$HSERVER/g" \
    | sed "s/dbX/$DB/g" \
    | sed "s/keypairX/$KEYPAIR/g" \
    | sed "s/claimX/$CLAIM/g" \
    | sed "s/volumeX/$VOLUME/g" \
    | sed "s/DEPLOY_TIME/`date`/" \
    | sed "s/CONNECTION_NAME/$CONNECTION_NAME/" \
    | kubectl apply -f -

echo waiting for $DEPLOYMENT to be available...
kubectl wait --for=condition=available --timeout=5m deployment/$DEPLOYMENT

if [ $? -ne 0 ]; then
    echo the deploy seems to have failed
    exit 1
fi
