# pino-eventhub

Load [pino](https://github.com/pinojs/pino) logs into
an [Event Hub](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-what-is-event-hubs).

## Install

```
npm install pino-eventhub -g
```

## Usage

```
  pino-eventhub

  To send pino logs to eventhub:

     cat log | pino-eventhub

  Key variables can be set as flags or environment variables.

  Flags
  -h  | --help              Display Help
  -v  | --version           display Version
  -s  | --event-hub-namespace        Required: the Event Hub Namespace; env var PINO_EVENT_HUB_NAMESPACE
  -e  | --event-hub                  Required: the Event Hub; env var PINO_EVENT_HUB
  -n  | --shared-access-policy-name  Required: the Shared Access Policy Name; env var PINO_SHARED_ACCESS_POLICY_NAME
  -a  | --sas                        the Shared Access Signature; env var PINO_SHARED_ACCESS_SIGNATURE
  -x  | --expiry                     the expiry of the SAS, in unix time; env var PINO_SAS_EXPIRY; default 1 week from now
  -b  | --size                       the number of documents for each bulk insert

  -k  | --shared-access-policy-key   the Shared Access Policy Key; env var PINO_SHARED_ACCESS_POLICY_KEY

```

## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).

## License

Licensed under [MIT](./LICENSE).
