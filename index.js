#!/usr/bin/env node
import { program } from 'commander'
import { spawn } from 'child_process'
import inquirer from 'inquirer'
import degit from 'degit'
import fs from 'fs-extra'
import path from 'path'
import yaml from 'js-yaml'

// Repository to clone and the branch you want to clone
const repoUrl = 'https://github.com/celaris-apps/celaris-src.git'
const tempDir = 'celaris-src-temp'

/**
 * This function filters the src path to exclude specific files/directories.
 *
 * This function is used as a filter function in the `fs.copy` function to exclude specific files/directories
 * from the copy operation. The function returns `true` if the src path should be included in the copy operation
 * and `false` if the src path should be excluded.
 *
 * @param {string} src the source path
 * @returns
 */
const filterFunc = (src) => {
  console.log('Filtering:', src)
  return (
    !src.includes(path.join(tempDir, '.git')) &&
    !src.includes(path.join(tempDir, 'README.md')) &&
    !src.includes(path.join(tempDir, 'package.json')) &&
    !src.includes(path.join(tempDir, '_gitignore'))
  )
}

/**
 * This function copies the files from the cloned repository to the current directory.
 *
 * This function uses the `fs.copy` function from the `fs-extra` module to copy the
 * files from the cloned repository to the current directory. The `filter` option is
 * used to exclude specific files/directories from the copy operation using the `filterFunc`.
 */
async function copyFiltedFiles() {
  try {
    await fs.copy(tempDir, '.', { filter: filterFunc, overwrite: true })
    console.log('Files copied successfully, excluding .git directory.')
  } catch (error) {
    console.error('Error copying files:', error)
  }
}

/**
 * This function fixes the package.json file
 *
 * This function reads the package.json file from the cloned repository and the local repository,
 * merges the scripts, dependencies, and devDependencies, and writes the merged lines back to the local package.json file.
 *
 * The function also deletes the package-lock.json file if it exists. So the user can run `npm install` to install the
 * newly merged dependencies.
 */
async function fixPackageJson() {
  try {
    // Check if the package.json file exists in the cloned repository and the local repository
    if (fs.existsSync(tempDir + '/package.json') && fs.existsSync('./package.json')) {
      // Read the package.json files from the cloned repository and the local repository
      let packageJson = fs.readFileSync('./package.json')
      let viteJson = fs.readFileSync(tempDir + '/package.json')
      if (packageJson && viteJson) {
        // Parse the package.json files
        let packageObj = JSON.parse(packageJson)
        let viteObj = JSON.parse(viteJson)

        // Extract the scripts, dependencies, and devDependencies from the vite package.json file
        let scripts = viteObj.scripts || {}
        let dependencies = viteObj.dependencies || {}
        let devDependencies = viteObj.devDependencies || {}

        // Add the celaris scripts to the package.json file
        scripts.cmake = 'cmake -S . -B ./src-celaris/build'
        scripts.cbuild = 'cmake --build ./src-celaris/build --config Release'
        scripts.cclean = 'cmake --build ./src-celaris/build --target clean'
        scripts.ctest = 'ctest --test-dir ./src-celaris/build --config Release'
        scripts.cmakeall = 'npm run cmake && npm run cbuild && npm run ctest'
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

/**
 * Merge the .gitignore files from the cloned repository and the local repository.
 *
 * This function reads the .gitignore file from the cloned repository and the local repository,
 * merges the lines, and writes the merged lines back to the local .gitignore file.
 *
 * The merged lines are normalized by trimming whitespace and duplicates are eliminated by using a Set.
 */
function mergeGitIgnoreFiles() {
  const gitIgnorePath = path.join(tempDir, '_gitignore')
  const gitIgnoreLocalPath = path.join(process.cwd(), '.gitignore')

  if (fs.existsSync(gitIgnorePath) && fs.existsSync(gitIgnoreLocalPath)) {
    // Get both .gitignore files as strings using the same encoding (utf8).
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

/**
 * This function runs a command in interactive mode.
 *
 * This function uses the `spawn` function from the `child_process` module to run a command in interactive mode.
 * The `stdio: 'inherit'` option is used to set up the input, output, and error streams to the parent process.
 * The `shell: true` option is used to run the command in a shell, which is necessary for npm scripts.
 *
 * The function returns a Promise that resolves when the command completes successfully with a code of 0.
 * If the command exits with a non-zero code, the Promise is rejected with an error.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<void>}
 */
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

/**
 * This function clones a repository and copies the files to the current directory.
 *
 * This function uses the degit library to clone a repository to a temporary directory.
 * The repository is cloned with the cache disabled and the force option enabled.
 * The files are then copied to the current directory using the copyFilteredFiles function.
 * The .git directory is excluded from the copy operation.
 *
 * The function also listens for info, warn, and error events from the emitter.
 *
 * @param {string} repo The repository to clone
 * @param {string} dest The destination directory
 * @param {bool} fixJson Whether to fix the package.json file
 */
async function cloneAndCopy(repo, dest, fixJson = false) {
  const emitter = degit(repo, {
    cache: false,
    force: true,
    verbose: true,
  })

  // Listen for info, warn, and error events from the emitter
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
    // Clone the repository to a temporary directory
    await emitter.clone(dest)

    // Copy the files to the current directory
    console.log('Copying files...')
    await copyFiltedFiles()

    // Merge the .gitignore files
    mergeGitIgnoreFiles()

    console.log('Removing temporary directory...')

    // Fix the package.json file if needed
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

/* ==================== Programs ==================== */

program.version('0.1.0').description('Celaris CLI tool')

/**
 * This function initialises the celaris project.
 *
 * # Steps
 *
 * ## Step 1: Fetch supported frameworks
 * The function fetches the supported frameworks from the celaris-apps/templates repository.
 * The user is prompted to select a framework from the supported frameworks.
 * The user is also prompted to enable TypeScript.
 * The user can also enter a custom framework repository.
 *
 * ## Step 2: Clone and copy the vite template repository
 * The selected framework is then used to clone the vite template repository.
 * The vite template repository is cloned to a temporary directory.
 * The files are then copied to the current directory using the copyFilteredFiles function.
 * After the files are copied, the temporary directory is removed.
 *
 * ## Step 3: Clone and copy the celaris-src repository
 * The function then clones the celaris-src repository to a temporary directory.
 * The files are copied to the current directory using the copyFilteredFiles function.
 * After the files are copied, the temporary directory is removed.
 *
 * ## Step 4: Install dependencies and run cmakeall script
 * The function then installs the dependencies in the current directory.
 * The function also installs the wait-on and concurrently packages as dev dependencies.
 * The function then runs the cmakeall script to configure, build, and test the C++ source.
 */
program
  .command('init')
  .description('Initialising celaris')
  .action(async () => {
    console.log('\n\nInitialising Vite...')

    console.log('Fetching supported frameworks...')
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

/**
 * This function runs the project in development mode.
 *
 * # Steps
 *
 * ## Step 1: Run the vite server
 * The function runs the vite server in development mode.
 * The port is set to 7832.
 *
 * ## Step 2: Run the cmakeall script
 * The function runs the cmakeall script to configure, build, and test the C++ source.
 * The function waits for the vite server to be ready before running the cmakeall script.
 *
 * ## Step 3: Run the execute script
 * The function runs the execute script to start the C++ application.
 *
 */
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

// program
//   .command('build')
//   .description('Build the project')
//   .action(() => {
//     console.log('Building the project.')
//   })

program.parse(process.argv)
