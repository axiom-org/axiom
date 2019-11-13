#!/bin/bash

# This script is the entry point for a Docker container that runs the hosting server.

echo ------------------------------ entry.sh ------------------------------

# Test that storage is writable
date > /storage/date

./node_modules/.bin/axiom host \
			  --filter /axboard.txt \
			  --storage /storage \
			  --verbose
