#!/usr/bin/env bash

# update the PINO_SHARED_ACCESS_POLICY_KEY with a valid key
# then exec file: `source pino-eventhub-access.sh`

export PINO_EVENT_HUB_NAMESPACE=pinoeventhubns

export PINO_EVENT_HUB=pinoeventhub

export PINO_SHARED_ACCESS_POLICY_NAME=sendPinoEvent

export PINO_SHARED_ACCESS_POLICY_KEY=your-access-key