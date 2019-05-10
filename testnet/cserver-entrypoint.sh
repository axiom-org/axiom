#!/bin/bash

# This script is the entry point for a Docker container that runs cserver.
# It is designed to be run on the Google cloud platform from the coinkit directory.

echo ------------------------------ cserver-entrypoint.sh ------------------------------

KEYPAIR=`find /secrets/keypair | grep json | head -1`
echo loading keypair: $KEYPAIR

cserver \
    --keypair=$KEYPAIR \
    --network=./testnet/network.json \
    --logtostdout \
    --http=8000

