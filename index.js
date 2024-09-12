#!/usr/bin/env node
import { program } from 'commander'
import { exec, spawn } from 'child_process'
import inquirer from 'inquirer'
import degit from 'degit'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import yaml from 'js-yaml'
import https from 'https'

// Repository to clone and the branch you want to clone
const repoUrl = 'https://github.com/celaris-apps/celaris-src.git'
const branch = 'main' // Change this to the branch you need
const tempDir = 'celaris-src-temp'

// Function to determine which files/folders to copy
const filterFunc = (src) => {
  console.log('Filtering:', src)
  return (
    !src.includes(path.join(tempDir, '.git')) &&
    !src.includes(path.join(tempDir, 'README.md')) &&
    !src.includes(path.join(tempDir, 'package.json')) &&
    !src.includes(path.join(tempDir, '_gitignore'))
  )
}

// Copy operation with filter
async function copyFiltedFiles() {
  try {
    await fs.copy(tempDir, '.', { filter: filterFunc, overwrite: true })
    console.log('Files copied successfully, excluding .git directory.')
  } catch (error) {
    console.error('Error copying files:', error)
  }
}

async function fixPackageJson() {
  try {
    if (fs.existsSync(tempDir + '/package.json') && fs.existsSync('./package.json')) {
      let packageJson = fs.readFileSync('./package.json')
      let viteJson = fs.readFileSync(tempDir + '/package.json')
      if (packageJson && viteJson) {
        let packageObj = JSON.parse(packageJson)
        let viteObj = JSON.parse(viteJson)

        let scripts = viteObj.scripts || {}
        let dependencies = viteObj.dependencies || {}
        let devDependencies = viteObj.devDependencies || {}

        scripts.cmake = 'cmake -S . -B ./src-celaris/build'
        scripts.cbuild = 'cmake --build ./src-celaris/build --config Release'
        scripts.cclean = 'cmake --build ./src-celaris/build --target clean'
        scripts.ctest = 'ctest --test-dir ./src-celaris/build --config Release'
        scripts.cmakeall = 'npm run cmake && npm run cbuild && npm run ctest'

        // scripts.cbuild = 'cmake-js build -O ./src-celaris/build'
        // scripts.cclean = 'cmake-js clean -O ./src-celaris/build'
        scripts.dev = 'vite --port 7832'
        scripts.execute = 'start ./src-celaris/build/bin/Release/celaris.exe'

        // Add the vite scripts to the package.json file
        packageObj.scripts = { ...packageObj.scripts, ...scripts }
        packageObj.dependencies = { ...packageObj.dependencies, ...dependencies }
        packageObj.devDependencies = { ...packageObj.devDependencies, ...devDependencies }

        // Write the updated package.json file
        fs.writeFileSync('./package.json', JSON.stringify(packageObj, null, 2))

        // delete the lock file
        if (fs.existsSync('./package-lock.json')) {
          fs.removeSync('./package-lock.json')
        }

        console.log('package.json updated successfully.')
      }
    }
  } catch (error) {
    console.error('Error reading package.json:', error)
  }
}

function mergeGitIgnoreFiles() {
  const gitIgnorePath = path.join(tempDir, '_gitignore')
  const gitIgnoreLocalPath = path.join(process.cwd(), '.gitignore')

  if (fs.existsSync(gitIgnorePath) && fs.existsSync(gitIgnoreLocalPath)) {
    const gitIgnore = fs.readFileSync(gitIgnorePath, 'utf8')
    const gitIgnoreLocal = fs.readFileSync(gitIgnoreLocalPath, 'utf8')

    // Normalize lines by trimming whitespace and converting to lower case.
    const gitIgnoreLines = gitIgnore.split('\n').map((line) => line.trim())
    const gitIgnoreLocalLines = gitIgnoreLocal.split('\n').map((line) => line.trim())

    // Use a Set to eliminate duplicates.
    const mergedLines = [...new Set([...gitIgnoreLines, ...gitIgnoreLocalLines])]

    // Write the merged lines back to the local .gitignore file.
    fs.writeFileSync(gitIgnoreLocalPath, mergedLines.join('\n'))
  }
}

async function runInteractiveCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit', // This option sets up the input, output, and error streams to the parent process
      shell: true, // This allows the command to be run in a shell, which is necessary for npm scripts
    })

    child.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Command exited with code ${code}`)
        reject(new Error(`Command exited with code ${code}`))
      } else {
        console.log(`Command completed successfully with code ${code}`)
        resolve()
      }
    })

    child.on('error', (error) => {
      console.error('Failed to start subprocess.', error)
      reject(error)
    })
  })
}

// // Clone, copy files, and remove temp directory
// async function gitCloneAndCopy(command, args = []) {
//   try {
//     console.log('Command:', command, args)

//     console.log('Cloning repository...')
//     await runInteractiveCommand(command, args)

//     console.log('Copying files...')
//     await copyFiltedFiles()

//     console.log('Removing temporary directory...')

//     if (command === 'npm') {
//       fixPackageJson()
//     }

//     // Removing the temporary directory
//     await fs.remove(tempDir)

//     console.log('Repository cloned and files copied successfully.')
//   } catch (error) {
//     console.error('Error during operation:', error)
//   }
// }

async function cloneAndCopy(repo, dest, fixJson = false) {
  const emitter = degit(repo, {
    cache: false,
    force: true,
    verbose: true,
  })

  emitter.on('info', (info) => {
    console.log(info.message)
  })

  emitter.on('warn', (warning) => {
    console.warn(warning.message)
  })

  emitter.on('error', (error) => {
    console.error(error.message)
  })

  try {
    await emitter.clone(dest)

    console.log('Copying files...')
    await copyFiltedFiles()

    mergeGitIgnoreFiles()

    console.log('Removing temporary directory...')

    if (fixJson) {
      fixPackageJson()
    }

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
  .action(async () => {
    console.log('\n\nInitialising Vite...')

    //get frameworks.yaml from https://raw.githubusercontent.com/celaris-apps/templates/main/frameworks.yaml

    async function readChoices() {
      try {
        const response = await fetch('https://raw.githubusercontent.com/celaris-apps/templates/main/frameworks.yaml')
        const data = await response.text()
        const frameworks = yaml.load(data)
        return frameworks
      } catch (e) {
        console.log('Error:', e.stack)
      }
    }

    const frameworks = await readChoices()

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'framework',
        message: 'Select a framework:',
        //TODO: Keep an eye on Qwik as the vite template is broken
        choices: frameworks.supported,
      },
      {
        type: 'input',
        name: 'customFramework',
        message: 'Enter the (public) repository of your vite template (user/repo/subdirectory*):',
        when: (answers) => answers.framework === 'Custom',
      },
      {
        type: 'list',
        name: 'typescript',
        message: 'Enable TypeScript:',
        choices: ['Yes', 'No'],
        when: (answers) => answers.framework !== 'Custom',
      },
      // {
      //   type: 'list',
      //   name: 'tailwind',
      //   message: 'Enable Tailwind:',
      //   choices: ['Yes', 'No'],
      // },
    ])

    console.log('Selected framework:', answers.framework)

    let template = `celaris-apps/templates/template-${answers.framework.toLowerCase()}${answers.typescript === 'Yes' ? '-ts' : ''}`
    if (answers.framework === 'Custom') {
      template = answers.customFramework
    }
    /**
     * Initialise Vite in a temporary directory then copy the files to the current directory
     * This is done to avoid conflicts with the existing package.json file.
     */
    await cloneAndCopy(`${template}`, tempDir, true)

    console.log('\n\nInitialising Celaris Source...')

    // Clone the C++ source repository and copy the files to the current directory
    await cloneAndCopy(repoUrl, tempDir)

    console.log('\n\nInitialising the project...')

    // Install the dependencies in the current directory
    await runInteractiveCommand('npm install')

    // await runInteractiveCommand('npm', ['install', 'cmake-js'])
    await runInteractiveCommand('npm', ['install', 'wait-on', 'concurrently', '--save-dev'])
    await runInteractiveCommand('npm', ['run', 'cmakeall'])

    console.log('Initialisation complete.')
  })

program
  .command('dev')
  .description('Run in development mode')
  .option('--no-build', 'disable the build step')
  .action(async (options) => {
    console.log('Running in development mode.')

    console.log('Options:', options)

    const cmd = `concurrently --kill-others "npm run dev" "wait-on http://localhost:7832 ${
      options.build ? '&& npm run cmakeall' : ''
    } && npm run execute"`

    console.log('Command', cmd)

    try {
      await runInteractiveCommand(cmd)
    } catch (error) {
      // do nothing as it will likely throw an error when the process is killed
    }
  })

program
  .command('build')
  .description('Build the project')
  .action(() => {
    console.log('Building the project.')
  })

program.parse(process.argv)
