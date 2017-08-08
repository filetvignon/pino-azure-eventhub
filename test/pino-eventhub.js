'use strict'

const expect = require('code').expect
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const pino = require('../../pino-eventhub')
var pump = require('pump')
var fs = require('fs')

lab.experiment('Pino Event Hub', () => {
  let opts
  let source
  let now
  let week
  let ehn
  let eh
  let sapn
  let sapk
  let se
  let host
  let uri

  lab.beforeEach((done) => {
    opts = {}
    source = fs.createReadStream('/dev/random')
    source.setEncoding('utf8')
    now = new Date()
    week = 60 * 60 * 24 * 7
    ehn = opts['event-hub-namespace'] || process.env.PINO_EVENT_HUB_NAMESPACE
    eh = opts['event-hub'] || process.env.PINO_EVENT_HUB
    sapn = opts['shared-access-policy-name'] || process.env.PINO_SHARED_ACCESS_POLICY_NAME
    sapk = opts['shared-access-policy-key'] || process.env.PINO_SHARED_ACCESS_POLICY_KEY
    se = opts.expiry || process.env.PINO_SAS_EXPIRY ||
            Math.round(now.getTime() / 1000) + week
    host = 'https://' + ehn + '.servicebus.windows.net'
    uri = encodeURIComponent(host + '/' + eh)
    done()
  })
  lab.test('returns done', (done) => {
    const sig = pino.createSignature(uri, se, sapk, true)
    expect(sig).to.exist()
    done()
  })

  lab.test('returns done', (done) => {
    const options = Object.assign(opts, {
      host,
      eh,
      sr: uri,
      sig: pino.createSignature(uri, se, sapk, false),
      se,
      skn: sapn
    })
    pump(source, pino.pinoEventHub(options), function (err) {
      expect(err).to.exist()
      expect(err.message).to.contain('premature close')
      done()
    })

    setTimeout(function () {
      source.destroy()
    }, 1000)
  })

  lab.test('returns done', (done) => {
    const options = Object.assign(opts, {
      host,
      eh,
      sr: uri,
      sig: 'no signature',
      se,
      skn: sapn
    })
    pump(source, pino.pinoEventHub(options), function (err) {
      expect(err).to.exist()
      expect(err.message).to.equal('401')
      done()
    })
    setTimeout(function () {
      source.destroy()
    }, 1000)
  })
})
