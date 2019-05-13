#!/bin/bash

echo path: $PATH
echo pwd: $(pwd)

NODE_NO_WARNINGS=1 ts-node --project tsconfig.node.json src/node/cli-main.ts $*
