#!/bin/bash

if [ "$NETWORK" != "alpha" ] && [ "$NETWORK" != "local" ]
then
    echo invalid NETWORK: [$NETWORK]
    exit 1
fi

parcel -p 2345 --no-hmr build \
       src/browser/popup-main.tsx \
       src/browser/background-main.ts \
       src/browser/content-main.ts \
       src/browser/loader-main.ts \
       -d ext-$NETWORK/
