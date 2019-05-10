#!/bin/bash

# A script to restart local servers and tail the logs.
./stop-local.sh
./start-local.sh

# If we couldn't restart, exit
if [ $? -ne 0 ]
then
    exit $?
fi

exec tail -f ~/logs/cserver0.log
