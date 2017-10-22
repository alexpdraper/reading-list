process.env.NODE_ENV = 'production'

const ora = require('ora')
const path = require('path')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const rm = require('rimraf')
const chalk = require('chalk')

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

    console.log(chalk.cyan('  Build complete. Congrats.\n'))
  })
})
