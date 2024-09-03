#!/usr/bin/env node
// const { program } = require('commander')
// const { exec } = require('child_process')

import { program } from 'commander'
import { exec } from 'child_process'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

// Repository to clone and the branch you want to clone
const repoUrl = 'https://github.com/celaris-apps/celaris-src.git'
const branch = 'main' // Change this to the branch you need
// const tempDir = path.join(os.tmpdir(), 'celaris-src-temp')
const tempDir = 'celaris-src-temp'

// Function to determine which files/folders to copy
const filterFunc = (src) => {
  return !src.includes(path.join(tempDir, '.git')) && !src.includes(path.join(tempDir, 'README.md'))
}

// Copy operation with filter
async function copyWithoutGit() {
  try {
    await fs.copy(tempDir, '.', { filter: filterFunc, overwrite: true })
    console.log('Files copied successfully, excluding .git directory.')
  } catch (error) {
    console.error('Error copying files:', error)
  }
}

// Function to execute shell commands
async function runCommand(command) {
  return new Promise((resolve, reject) => {
    const process = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Execution Error:', error)
        reject(error)
      } else if (stderr) {
        console.log(stderr) // Log standard error but do not reject
      }
      resolve(stdout) // Resolve regardless of stderr if no execution error
    })

    process.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`))
      } else {
        console.log(`Command completed successfully with code ${code}`)
      }
    })
  })
}

// Clone, copy files, and remove temp directory
async function cloneAndCopy() {
  try {
    console.log('Cloning repository...')
    // Cloning into a temporary directory
    await runCommand(`git clone ${repoUrl} ${tempDir}`)

    console.log('Copying files...')
    // // Copying files to the current directory
    await copyWithoutGit()

    console.log('Removing temporary directory...')
    // Removing the temporary directory
    await fs.remove(tempDir)

    console.log('Repository cloned and files copied successfully.')
  } catch (error) {
    console.error('Error during operation:', error)
  }
}

program.version('0.1.0').description('An example CLI for npm package')

program
  .command('init')
  .description('Initialising celaris')
  .action(() => {
    cloneAndCopy()
    console.log('Initialisation complete.')
  })

program
  .command('dev')
  .description('Run in development mode')
  .action(() => {
    console.log('Running in development mode.')
  })

program.parse(process.argv)
