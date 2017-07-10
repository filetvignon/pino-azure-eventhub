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
const Parse = require('fast-json-parse')

function giveSecurityWarning () {
  console.warn("It is poor security practice to share your Shared Access Policy Key. It is better to calculate the Shared Access Signature, and share that.")
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

function pinoEventHub (opts) {
  const splitter = split(function (line) {
    return line
  })

  const url = decodeURIComponent(opts.sr) + '/messages'
  const options = {
    method: 'POST',
    host: opts.host.slice(8), // remove 'https://'
    port: opts.port,
    path: '/' + opts.eh + '/messages?timeout=60&api-version=2014-01',
    headers: {
      Authorization: 'SharedAccessSignature sr=' + opts.sr + '&sig=' + opts.sig + '&se=' + opts.se + '&skn=' + opts.skn,
      'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
    }
  }

  const bulkHeaders = Object.assign({}, options.headers,
    { 'Content-Type': 'application/vnd.microsoft.servicebus.json' })
  const bulkOptions = Object.assign({}, options,
    { headers: bulkHeaders })

  function callback(done) {
    return function inner(response) {
      debug('response.statusCode =', response.statusCode)
      debug('response.statusMessage =', response.statusMessage)

      if (response.statusCode != 201) {
        // splitter.emit(`response error =`, response.statusMessage)
        console.log(`response error =`, response.statusMessage)
      }

      response.on('data', function (data) {
        debug('data =', data)
      })

      response.on('end', function () {
        debug('call completed')
        done()
      })
    }
  }

  const index = opts.index || 'pino'
  const type = opts.type || 'log'

  const writable = new Writable({
    objectMode: true,
    highWaterMark: opts['bulk-size'] || 500,
    writev: function (lines, done) {
      // https://docs.microsoft.com/en-us/rest/api/eventhub/send-batch-events
      const events = lines
        .map(line => {
          // check if console output is a string or object
          var parsed = new Parse(line)
          if (parsed.err) {
            return `{"Body":"${line}"}`
          }
          return `{"Body":${line}}`
        })
        .join(',')
      debug(`events =`, events)

      const req = https.request(bulkOptions, callback(done))
      req.on('error', (e) => {
        console.error(`request error =`, e)
        done()
      })
      req.write(`[${events}]`)
      req.end()
    },
    write: function (line, enc, done) {
      debug(`write: line =`, line)
      debug(`write: typeof ===`, typeof line)
      if (line) {
        const req = https.request(options, callback(done))
        req.on('error', (e) => {
          console.error(`request error =`, e)
          done()
        })
        req.write(line)
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

  const ehn = opts['event-hub-namespace'] || process.env.PINO_EVENT_HUB_NAMESPACE
  const eh = opts['event-hub'] || process.env.PINO_EVENT_HUB
  const sapn = opts['shared-access-policy-name'] || process.env.PINO_SHARED_ACCESS_POLICY_NAME
  const sapk = opts['shared-access-policy-key'] || process.env.PINO_SHARED_ACCESS_POLICY_KEY
  const sas = opts['sas'] || process.env.PINO_SHARED_ACCESS_SIGNATURE

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

  const now = new Date()
  const week = 60*60*24*7
  const host = 'https://' + ehn + '.servicebus.windows.net'
  //  path = eh
  const uri = encodeURIComponent(host + '/' + eh)
  const se = opts.expiry || process.env.PINO_SAS_EXPIRY
    || Math.round(now.getTime() / 1000) + week
  const options = Object.assign(opts, {
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
