#! /usr/bin/env node
'use strict'

const Writable = require('readable-stream').Writable
const split = require('split2')
const pump = require('pump')
const utf8 = require('utf8')
const crypto = require('crypto')
const https = require('https')
const debug = require('debug')('pino-eventhub')
const Parse = require('fast-json-parse')



function giveSecurityWarning () {
  console.warn('It is poor security practice to share your Shared Access Policy Key. It is better to calculate the Shared Access Signature, and share that.')
  console.log("'pino-eventhub.createSignature' can be used to calculate the Shared Access Signature.")
}

function createSignature (uri, ttl, sapk, warn) {
  if (warn) {
    giveSecurityWarning()
  }

  const signature = uri + '\n' + ttl
  const signatureUTF8 = utf8.encode(signature)
  const hash = crypto.createHmac('sha256', sapk)
    .update(signatureUTF8)
    .digest('base64')
  return encodeURIComponent(hash)
}

function pinoEventHub (opts, keepAliveAgent, sockets) {
  const splitter = split(function (line) {
    return line
  })

  const options = {
    method: 'POST',
    host: opts.host.slice(8), // remove 'https://'
    port: opts.port,
    agent: keepAliveAgent,
    path: '/' + opts.eh + '/messages?timeout=60&api-version=2014-01',
    headers: {
      Authorization: 'SharedAccessSignature sr=' + opts.sr + '&sig=' + opts.sig + '&se=' + opts.se + '&skn=' + opts.skn,
      'Content-Type': 'application/atom+xml;type=entry;charset=utf-8'
    }
  }

  const bulkHeaders = Object.assign({}, options.headers,
    { 'Content-Type': 'application/vnd.microsoft.servicebus.json' })
  const bulkOptions = Object.assign({}, options,
    { headers: bulkHeaders })

  function callback (done) {
    return function inner (response) {
      debug('response.statusCode =', response.statusCode)
      debug('response.statusMessage =', response.statusMessage)
      if (response.statusCode !== 201) {
        splitter.emit('error', new Error(response.statusCode))
      }

      response.on('data', function (data) {
        debug('data =', data.toString())
      })

      response.on('end', function () {
        debug('call completed')
        done()
      })
    }
  }

  const writable = new Writable({
    objectMode: true,
    highWaterMark: opts['bulk-size'] || 500,
    writev: function (blocks, done) {
      // https://docs.microsoft.com/en-us/rest/api/eventhub/send-batch-events
      const events = blocks
        .map(block => block.chunk)
        .map(line => {
          // check if console output is a string or object
          const parsed = new Parse(line)
          return (parsed.err)
            ? JSON.stringify({ Body: line })
            : `{"UserProperties":${line}}`
        })
        .join(',')
      const body = `[${events}]`
      debug(`body =`, body)

      const req = https.request(bulkOptions, callback(done))
      req.on('error', (e) => {
        console.error(`request error =`, e)
        done()
      })
      req.write(body)
      req.end()
    },
    write: function (line, enc, done) {
      debug(`write: line =`, line)
      debug(`write: typeof ===`, typeof line)
      if (line) {
        const req = https.request(options, callback(done))
        req.on('error', (e) => {
          console.error(`request error =`, e)
        })
        req.on("socket", function (socket) {
          if (sockets.indexOf(socket) === -1) {
            debug("new socket created");
            sockets.push(socket);
            socket.on("close", function() {
                debug("socket has been closed");
            });
          }
        });
        req.write(line)
        req.end()
      } else {
        done()
      }
    }
  })

  pump(splitter, writable)

  return splitter
}

module.exports = {
  createSignature: createSignature,
  pinoEventHub: pinoEventHub,
  giveSecurityWarning: giveSecurityWarning
}
