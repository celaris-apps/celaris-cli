#!/usr/bin/env node
import { program } from 'commander'
import { runDev } from './functions.js'

/* ==================== Programs ==================== */

program.version('0.1.0').description('Celaris CLI tool')

// program
//   .command('init')
//   .description('Initialising celaris')
//   .action(async () => {
//     initialiseCelaris()
//   })

program
  .command('dev')
  .description('Run in development mode')
  .option('--no-build', 'disable the build step')
  .option('--no-tests', 'run the tests')
  .action(async (options) => {
    runDev(options)
  })

// program
//   .command('build')
//   .description('Build the project')
//   .action(() => {
//     console.log('Building the project.')
//   })

//default command
program.command('*').action(() => {
  console.log('Invalid command')
  program.help()
})

program.parse(process.argv)
