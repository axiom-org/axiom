#!/bin/bash

# This script is the entry point for a Docker container that runs the node hosting server.
# It is designed to be run on the Google cloud platform from the axiom/ts directory.

echo ------------------------------ hserver-entrypoint.sh ------------------------------

KEYPAIR=`find /secrets/keypair | grep json | head -1`
echo loading keypair: $KEYPAIR

node --prof ./build/node/node/hserver-main.js \
     --keypair=$KEYPAIR \
     --network=alpha \
     --directory=/hostfiles \
     --capacity=10000
