# pino-eventhub

## Azure Setup 

Tests run against Azure Event Hub.  To spin up an event hub, take a look at [https://github.com/nearform/azure-eventhub](https://github.com/nearform/azure-eventhub)

## Tests

To run tests, you will need to export the following environment variables:

```
export PINO_EVENT_HUB_NAMESPACE=pinoeventhubns

export PINO_EVENT_HUB=pinoeventhub

export PINO_SHARED_ACCESS_POLICY_NAME=sendPinoEvent

export PINO_SHARED_ACCESS_POLICY_KEY=your-access-key
```


Or update the PINO_SHARED_ACCESS_POLICY_KEY environment variable in test/pino-eventhub-access.sh

then enter the commands below:

``` 
source ./test/pino=eventhub-access.sh 

npm run test 
```
