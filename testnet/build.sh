#!/bin/bash

if [ "$1" == "" ] || [ "$2" != "" ]; then
    echo "usage: ./build.sh <name>"
    exit 1
fi

if [ "${PROJECT_ID}" == "" ]; then
    echo "the PROJECT_ID environment variable is not set. check the readme"
    exit 1
fi

if [ ! -f ./deployment.yaml ]; then
    echo "please run build.sh from the testnet directory"
    exit 1
fi

if [[ $(git diff) ]]; then
    echo "build.sh creates a container from master. check in your changes before building."
    exit 1
fi

if [[ $(git status | grep "branch is ahead") ]]; then
    echo "build.sh creates a container from master. push your changes before building."
    exit 1
fi

DOCKERFILE="./$1-Dockerfile"
if [ ! -f "$DOCKERFILE" ]; then
    echo $1 is not a valid name. try one of:
    ls | grep Dockerfile | sed s/-Dockerfile//
    exit 1
fi

DOMAIN=gcr.io
NAME=$DOMAIN/${PROJECT_ID}/$1

# The `--no-cache` is needed because the build process grabs fresh code from GitHub, and
# if you enable the cache it'll keep using your old code.
echo building $NAME image...
docker build \
       --no-cache \
       --tag $NAME \
       --file $DOCKERFILE \
       .

if [ $? -ne 0 ]; then
    exit 1
fi

# Upload it to the container registry
echo uploading to the registry...
docker push $NAME
