#! /usr/bin/env node
'use strict'

const minimist = require('minimist')
const Writable = require('readable-stream').Writable
const split = require('split2')
const pump = require('pump')
const fs = require('fs')
const path = require('path')
const utf8 = require('utf8')
const crypto = require('crypto')
const https = require('https')
const debug = require('debug')('pino-eventhub')

function giveSecurityWarning () {
  console.warn("It is poor security practice to share your Shared Access Policy Key. It is better to calculate the Shared Access Signature, and share that.")
  console.log("'pino-eventhub.createSignature' can be used to calculate the Shared Access Signature.")
}

function createSignature (uri, ttl, sapk, warn) {
  if (warn) {
    giveSecurityWarning()
  }

  var signature = uri + '\n' + ttl
  var signatureUTF8 = utf8.encode(signature)
  var hash = crypto.createHmac('sha256', sapk)
    .update(signatureUTF8)
    .digest('base64')
  return encodeURIComponent(hash)
}

function pinoEventHub (opts) {
  const splitter = split(function (line) {
    return line
  })

  var url = decodeURIComponent(opts.sr) + '/messages'
  var options = {
    method: 'POST',
    host: opts.host.slice(8), // remove 'https://'
    port: opts.port,
    path: '/' + opts.eh + '/messages',
    headers: {
      Authorization: 'SharedAccessSignature sr=' + opts.sr + '&sig=' + opts.sig + '&se=' + opts.se + '&skn=' + opts.skn,
      'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
    }
  }

  function callback(done) {
    return function inner(response) {
      if (response.statusCode != 201) {
        console.log(`response error =`, response.statusMessage)
      }

      response.on('end', function () {
        done()
      })
    }
  }

  const writable = new Writable({
    objectMode: true,
    highWaterMark: opts['bulk-size'] || 500,
    write: function (body, enc, done) {
      debug(`write: body =`, body)
      debug(`write: typeof ===`, typeof body)
      if (body) {
        var req = https.request(options, callback(done))
        req.on('error', (e) => {
          console.error(`request error =`, e)
          done()
        })
        req.write(body)
        req.end()
      } else {
        done()
      }
    },
  })

  pump(splitter, writable)

  return splitter
}


module.exports = {
  createSignature: createSignature,
  pinoEventHub: pinoEventHub,
}

function start (opts) {
  if (opts.help) {
    console.log(fs.readFileSync(path.join(__dirname, './usage.txt'), 'utf8'))
    return
  }

  if (opts.version) {
    console.log('pino-eventhub', require('./package.json').version)
    return
  }

  var ehn = opts['event-hub-namespace'] || process.env.PINO_EVENT_HUB_NAMESPACE
  var eh = opts['event-hub'] || process.env.PINO_EVENT_HUB
  var sapn = opts['shared-access-policy-name'] || process.env.PINO_SHARED_ACCESS_POLICY_NAME
  var sapk = opts['shared-access-policy-key'] || process.env.PINO_SHARED_ACCESS_POLICY_KEY
  var sas = opts['sas'] || process.env.PINO_SHARED_ACCESS_SIGNATURE

  if (!ehn || !eh || !sapn || (!sas && !sapk) ) {
    console.log(fs.readFileSync(path.join(__dirname, './usage.txt'), 'utf8'))
    console.log("  1 or more missing required parameters 'event-hub-namespace', 'event-hub', 'shared-access-policy-name' and  'sas'.")
    if (!sas) {
      giveSecurityWarning()
    }
    return
  }
  if (opts.expiry && !Number.isNumber(opts.expiry)) {
    console.log(`"expiry" should be in unix date format`)
    return
  }

  var now = new Date()
  var week = 60*60*24*7
  var host = 'https://' + ehn + '.servicebus.windows.net'
  // var path = eh
  var uri = encodeURIComponent(host + '/' + eh)
  var se = opts.expiry || process.env.PINO_SAS_EXPIRY
    || Math.round(now.getTime() / 1000) + week
  var options = Object.assign(opts, {
    host,
    eh,
    sr: uri,
    sig: sas || createSignature(uri, se, sapk, true),
    se,
    skn: sapn,
  })

  pump(process.stdin, pinoEventHub(options))
}

if (require.main === module) {
  start(minimist(process.argv.slice(2), {
    alias: {
      version: 'v',
      help: 'h',
      'event-hub-namespace': 's',
      'event-hub': 'e',
      'shared-access-policy-name': 'n',
      'shared-access-policy-key': 'k',
      'expiry': 'x',
      'sas': 'a',
      'bulk-size': 'b',
      'port': 'p',
    },
    default: {
      port: 443,
      'bulk-size': 500,
    }
  }))
}
