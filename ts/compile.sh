#!/bin/bash

echo tsc --build tsconfig.node.json
tsc --build tsconfig.node.json || exit 1
echo OK
echo tsc --build tsconfig.browser.json
tsc --build tsconfig.browser.json || exit 1
echo OK
