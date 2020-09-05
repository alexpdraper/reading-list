process.env.NODE_ENV = 'production'

const targetBrowser = process.argv.length >= 3
  ? process.argv[2]
  : ''

const chalk = require('chalk')

if (!['chrome', 'firefox', 'edge'].includes(targetBrowser)) {
  return console.log(chalk.red(
    'Specify “chrome”, “firefox” or “edge”  as the target browser'))
}

const ora = require('ora')
const path = require('path')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const rm = require('rimraf')
const manifestBuilder = require('./manifest')

const spinner = ora('building for production…')
spinner.start()

rm(path.resolve(__dirname, '..', 'dist'), err1 => {
  if (err1) throw err1
  webpack(webpackConfig, (err2, stats) => {
    spinner.stop()
    if (err1) throw err2
    process.stdout.write(stats.toString({
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }) + '\n\n')

    // Build the manifest
    manifestBuilder(targetBrowser, err3 => {
      if (err3) throw err3
      console.log(chalk.cyan('  Build complete.\n'))
    })
  })
})
