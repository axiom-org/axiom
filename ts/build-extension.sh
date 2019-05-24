#!/bin/bash

if [ "$NETWORK" != "alpha" ] && [ "$NETWORK" != "local" ]
then
    echo invalid NETWORK: [$NETWORK]
    exit 1
fi

VERSION=$(grep '^ *\"version\":' ./package.json | head -1 | sed 's/^ *\"version\": \"//' | sed s/\",//)
echo version: $VERSION

sed -i 's/\(^ *\"version\": \"\).*\(\",\)$/\1MARKER\2/' ext-$NETWORK/manifest.json
sed -i s/MARKER/$VERSION/ ext-$NETWORK/manifest.json

parcel -p 2345 --no-hmr build \
       src/browser/popup-main.tsx \
       src/browser/background-main.ts \
       src/browser/content-main.ts \
       src/browser/loader-main.ts \
       -d ext-$NETWORK/

if [ "$NODE_ENV" == "production"]
then
    echo zipping extension files...
fi
