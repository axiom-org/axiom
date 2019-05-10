#!/bin/bash

PIDS=`pgrep '^cserver'`
if [ -z "$PIDS" ]
then
    echo the local cservers are already stopped
    exit 0
fi
echo $PIDS | xargs kill -9
sleep 0.1
LEFT=`ps aux | grep '[^a-z]cserver' | grep -v grep`
if [ -n "$LEFT" ]
then
    echo "could not kill:"
    echo $LEFT
fi
