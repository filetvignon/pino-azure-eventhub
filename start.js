#! /usr/bin/env node
"use strict";

const minimist = require("minimist");
const { pipeline } = require("stream");
const fs = require("fs");
const path = require("path");
const pinoEventHub = require("./pino-eventhub");
const socketCount = 10;

function start(opts) {
  if (opts.help) {
    console.log(fs.readFileSync(path.join(__dirname, "./usage.txt"), "utf8"));
    return;
  }

  if (opts.version) {
    console.log("pino-eventhub", require("./package.json").version);
    return;
  }

  let eh = opts["event-hub"] || process.env.EVENT_HUB_NAME;
  let ehn = opts["event-hub-namespace"] || process.env.PINO_EVENT_HUB_NAMESPACE;
  let sapn =
    opts["shared-access-policy-name"] ||
    process.env.PINO_SHARED_ACCESS_POLICY_NAME;
  let sapk =
    opts["shared-access-policy-key"] ||
    process.env.PINO_SHARED_ACCESS_POLICY_KEY;
  let sas = opts["sas"] || process.env.PINO_SHARED_ACCESS_SIGNATURE;

  const url = opts["url"] || process.env.EVENT_HUB_URL;
  const max = opts["max"] || socketCount;

  if (!ehn || !eh || !sapn || (!sas && !sapk)) {
    if (url) {
      const regex = new RegExp(
        "Endpoint=sb://(?<endpoint>[^;]*).servicebus.windows.net/?;SharedAccessKeyName=(?<sharedAccessKeyName>[^;]*);SharedAccessKey=(?<sharedAccessKey>[^;]*)(;EntityPath=(?<entityPath>[^;]*))?"
      );

      const regexMatch = regex.exec(url);

      if (regexMatch && regexMatch.groups) {
        const {
          groups: {
            endpoint,
            sharedAccessKeyName,
            sharedAccessKey,
            entityPath,
          },
        } = regexMatch;
        if (!ehn && endpoint) ehn = endpoint;
        if (!eh && entityPath) eh = entityPath;
        if (!sapn && sharedAccessKeyName) sapn = sharedAccessKeyName;
        if (!sapk && !sas && sharedAccessKey) sapk = sharedAccessKey;
      }
    }

    if (!ehn || !eh || !sapn || (!sas && !sapk)) {
      console.log(fs.readFileSync(path.join(__dirname, "./usage.txt"), "utf8"));
      console.log(
        "  1 or more missing required parameters 'event-hub-namespace', 'event-hub', 'shared-access-policy-name' and 'sas' (or 'url' containing all parameters)."
      );
      return;
    }
  }

  if (
    opts.expiry &&
    (typeof opts.expiry !== "number" || Number.isNaN(opts.expiry))
  ) {
    console.log(`"expiry" should be in unix date format`);
    return;
  }

  const year = 365 * 24 * 3600;
  const host = "https://" + ehn + ".servicebus.windows.net";
  //  path = eh
  const uri = encodeURIComponent(host + "/" + eh);
  const se =
    opts.expiry ||
    process.env.PINO_SAS_EXPIRY ||
    Math.round(Date.now() / 1000) + year;
  const options = Object.assign(opts, {
    host,
    eh,
    sr: uri,
    sig: sas || pinoEventHub.createSignature(uri, se, sapk),
    se,
    skn: sapn,
    max: max,
  });

  pipeline(process.stdin, pinoEventHub(options), () => {});
}

if (require.main === module) {
  start(
    minimist(process.argv.slice(2), {
      alias: {
        version: "v",
        help: "h",
        "event-hub-namespace": "s",
        "event-hub": "e",
        "shared-access-policy-name": "n",
        "shared-access-policy-key": "k",
        expiry: "x",
        sas: "a",
        url: "u",
        "bulk-size": "b",
        port: "p",
      },
      default: {
        port: 443,
        "bulk-size": 500,
      },
    })
  );
}
