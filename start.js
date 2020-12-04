#! /usr/bin/env node
'use strict'

const minimist = require('minimist')
const pump = require('pump')
const fs = require('fs')
const path = require('path')
const pinoEventHub = require('./pino-eventhub')
const socketCount = 10

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
  const max = opts['max'] || socketCount

  if (!ehn || !eh || !sapn || (!sas && !sapk)) {
    console.log(fs.readFileSync(path.join(__dirname, './usage.txt'), 'utf8'))
    console.log("  1 or more missing required parameters 'event-hub-namespace', 'event-hub', 'shared-access-policy-name' and  'sas'.")
    if (!sas) {
      pinoEventHub.giveSecurityWarning()
    }
    return
  }
  if (opts.expiry && (typeof opts.expiry !== 'number' || Number.isNaN(opts.expiry))) {
    console.log(`"expiry" should be in unix date format`)
    return
  }

  const now = new Date()
  const week = 60 * 60 * 24 * 7
  const host = 'https://' + ehn + '.servicebus.windows.net'
  //  path = eh
  const uri = encodeURIComponent(host + '/' + eh)
  const se = opts.expiry || process.env.PINO_SAS_EXPIRY ||
    Math.round(now.getTime() / 1000) + week
  const options = Object.assign(opts, {
    host,
    eh,
    sr: uri,
    sig: sas || pinoEventHub.createSignature(uri, se, sapk, true),
    se,
    skn: sapn,
    max: max
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
      'port': 'p'
    },
    default: {
      port: 443,
      'bulk-size': 500
    }
  }))
}
