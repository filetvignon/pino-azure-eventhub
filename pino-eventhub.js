#! /usr/bin/env node
"use strict";

const { Writable, pipeline } = require("stream");
const split = require("split2");
const crypto = require("crypto");
const https = require("https");
const debug = require("debug")("pino-eventhub");
const socketCount = 10;

function createSignature(uri, ttl, sapk) {
  const signature = uri + "\n" + ttl;
  const hash = crypto
    .createHmac("sha256", sapk)
    .update(signature)
    .digest("base64");
  return encodeURIComponent(hash);
}

function pinoEventHub(opts) {
  const {
    host,
    port,
    eh,
    sr,
    sig,
    se,
    skn,
    max,
    ["bulk-size"]: bulkSize,
  } = opts;

  const splitter = split(function (line) {
    return line;
  });
  const agent = new https.Agent({
    keepAlive: true,
    maxSockets: max || socketCount,
  });
  const options = {
    method: "POST",
    host: host.slice(8), // remove 'https://'
    port: port,
    agent: agent,
    path: "/" + eh + "/messages?timeout=60&api-version=2014-01",
    headers: {
      Authorization:
        "SharedAccessSignature sr=" +
        sr +
        "&sig=" +
        sig +
        "&se=" +
        se +
        "&skn=" +
        skn,
      "Content-Type": "application/atom+xml;type=entry;charset=utf-8",
    },
  };

  const bulkHeaders = Object.assign({}, options.headers, {
    "Content-Type": "application/vnd.microsoft.servicebus.json",
  });
  const bulkOptions = Object.assign({}, options, { headers: bulkHeaders });

  function callback(done) {
    return function inner(response) {
      debug("response.statusCode =", response.statusCode);
      debug("response.statusMessage =", response.statusMessage);
      if (response.statusCode !== 201) {
        splitter.emit("error", new Error(response.statusCode));
      }

      response.on("data", function (data) {
        debug("data =", data.toString());
      });

      response.on("end", function () {
        debug("call completed");
        done();
      });
    };
  }

  const writable = new Writable({
    objectMode: true,
    highWaterMark: bulkSize || 500,
    writev: function (blocks, done) {
      // https://docs.microsoft.com/en-us/rest/api/eventhub/send-batch-events
      const events = blocks
        .map((block) => block.chunk)
        .map((line) => ({ Body: line }));

      const body = JSON.stringify(events);
      debug(`body =`, body);

      const req = https.request(bulkOptions, callback(done));
      req.on("error", (e) => {
        console.error(`request error =`, e);
        done();
      });
      req.write(body);
      req.end();
    },
    write: function (line, enc, done) {
      debug(`write: line =`, line);
      debug(`write: typeof ===`, typeof line);
      if (line) {
        const req = https.request(options, callback(done));
        req.on("error", (e) => {
          console.error(`request error =`, e);
        });
        req.write(line);
        req.end();
      } else {
        done();
      }
    },
  });

  pipeline(splitter, writable, () => {});

  return splitter;
}
module.exports = pinoEventHub;
module.exports.createSignature = createSignature;
