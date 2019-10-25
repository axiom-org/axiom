#!/bin/bash

# This script is the entry point for a Docker container that runs the hosting server.

echo ------------------------------ entry.sh ------------------------------

KEYPAIR=`find /secrets/keypair | grep json | head -1`
echo accessing and then ignoring keypair: $KEYPAIR
echo ls /hostfiles :
ls /hostfiles

axiom host
