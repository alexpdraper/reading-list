process.env.NODE_ENV = 'production'

const targetBrowser = process.argv.length >= 3
  ? process.argv[2]
  : ''

const chalk = require('chalk')

if (!['chrome', 'firefox'].includes(targetBrowser)) {
  return console.log(chalk.red(
    'Specify “chrome” or “firefox” as the target browser'))
}

const ora = require('ora')
const path = require('path')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const rm = require('rimraf')
const manifestBuilder = require('./manifest')

const spinner = ora('building for production…')
spinner.start()

rm(path.resolve(__dirname, '..', 'dist'), err => {
  if (err) throw err
  webpack(webpackConfig, (err, stats) => {
    spinner.stop()
    if (err) throw err
    process.stdout.write(stats.toString({
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }) + '\n\n')

    // Build the manifest
    manifestBuilder(targetBrowser, err => {
      if (err) throw err
      console.log(chalk.cyan('  Build complete.\n'))
    })
  })
})
