const base = require('../src/manifest/base.json')
const chromeOptions = require('../src/manifest/chrome.json')
const firefoxOptions = require('../src/manifest/firefox.json')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const manifestOptions = {
  chrome: chromeOptions,
  firefox: firefoxOptions
}

module.exports = function (browser, callback) {
  const filePath = path.resolve(__dirname, '..', 'dist', 'manifest.json')
  const manifest = _.merge({}, base, manifestOptions[browser])

  // generates the manifest file using the package.json version
  manifest.version = process.env.npm_package_version

  fs.writeFile(filePath, JSON.stringify(manifest), callback)
}
