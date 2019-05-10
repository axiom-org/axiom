#!/bin/bash

LOGS="$HOME/logs"

if [ ! -d "$LOGS" ]; then
    echo "please create a logs directory in ~/logs"
    exit 1
fi

if [ `pwd | sed s/.*src//` != "/github.com/lacker/coinkit" ]; then
    echo "please run this from the coinkit directory"
    exit 1
fi

RUNNING=`pgrep ^cserver`
if [ -n "$RUNNING" ]
then
    echo "there are already cservers running:"
    ps aux | grep [^a-z]cserver | grep -v grep
    exit 1
fi

echo rebuilding binaries...
go install ./...

if [ $? -ne 0 ]
then
    echo "not starting cservers due to error"
    exit 1
fi

for i in `seq 0 3`;
do
    ARGS="--database=./local/database$i.json"
    ARGS="$ARGS --keypair=./local/keypair$i.json"
    ARGS="$ARGS --network=./local/network.json"
    ARGS="$ARGS --http=800$i"
    nohup cserver $ARGS &> $LOGS/cserver$i.log &
done

sleep 0.1
ps aux | grep [^a-z]cserver | grep -v grep
