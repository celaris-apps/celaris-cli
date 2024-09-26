import { spawn } from 'child_process'
import chokidar from 'chokidar'
import waitOn from 'wait-on'
import path from 'path'
import { resolve } from 'path'
import os from 'os'

let viteProcess = null
let watcher = null
let cppProcess = null
let options = null
let buildCommands = []
let buildTimeout = null
let firstRun = true

// Execute build commands sequentially
const runBuildCommands = async () => {
  for (const command of buildCommands) {
    console.log(`Running command: ${command.cmd} ${command.args.join(' ')}`)
    await new Promise((resolve, reject) => {
      const proc = spawn(command.cmd, command.args, { stdio: 'inherit', shell: true })
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`${command.cmd} exited with code ${code}`))
        } else {
          resolve()
        }
      })
    })
  }
}

/**
 * This function builds and starts the C++ application.
 * It first kills the existing C++ process if running.
 * Then it builds the C++ application using CMake and starts the application.
 * If the `--no-build` option is passed, it skips the build step.
 * If the `--no-tests` option is passed, it skips running the tests.
 * If the build fails, it logs the error.
 *
 * The function also sets up a watcher to watch for changes in the src-celaris directory.
 */
const buildAndStartCpp = async () => {
  console.log('Building and starting C++ application...')
  // Kill existing C++ process if running
  if (cppProcess) {
    cppProcess.kill()
  }

  buildCommands = []

  if (!firstRun || options.build !== false) {
    buildCommands.push(
      { cmd: 'cmake', args: ['-S', '.', '-B', './src-celaris/build'] },
      { cmd: 'cmake', args: ['--build', './src-celaris/build', '--config', 'Debug'] }
    )

    if (options.tests !== false) {
      buildCommands.push({ cmd: 'ctest', args: ['--test-dir', './src-celaris/build', '-C', 'Debug'] })
    }
  }
  // Set firstRun to false after the first run so that 'no-build' options
  // are ignored when a file is changed
  firstRun = false

  await runBuildCommands()
    .then(() => {
      console.log('C++ application built successfully.')
      console.log('Starting C++ application...')

      //Build path to executable based on platform
      let pathParts = ['.', 'src-celaris', 'build', 'bin']
      if (os.platform() === 'win32') {
        pathParts.push('Debug', 'celaris.exe')
      } else {
        pathParts.push('celaris')
      }

      const executablePath = path.join(...pathParts)
      console.log('Executable path:', executablePath)

      cppProcess = spawn(executablePath, [], {
        detached: true,
        stdio: 'ignore',
      })

      cppProcess.unref()
    })
    .catch((error) => {
      console.error('Build failed:', error)
    })
  console.log('Build and start done')
}

/**
 * This function is called when the user exits the program.
 * It kills the C++ and Vite processes and closes the watcher.
 */
const cleanUp = () => {
  if (cppProcess) {
    cppProcess.kill()
  }
  viteProcess.kill()
  watcher.close()
  process.exit()
}

/**
 * This function is called when the `dev` command is run.
 *
 * It goes through the following steps:
 * 1. Start the Vite development server
 * 2. Build and start the C++ application
 * 3. Watch for changes in the src-celaris directory
 * 4. Clean up processes when the user exits
 *
 * @param {*} opts Options passed from the CLI
 */
export async function runDev(opts) {
  options = opts
  console.log('Running in development mode.')
  console.log('Options:', options)
  console.log('Starting Vite server...')

  // Start the Vite development server
  viteProcess = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true })

  console.log('Waiting for Vite server to be ready...')
  // Wait for Vite server to be ready
  await waitOn({ resources: ['http://localhost:7832'], timeout: 30000 })

  console.log('Vite server is ready.')

  // Initial build and start
  await buildAndStartCpp()

  // Watch for changes in src-celaris directory
  const srcCelarisPath = resolve(process.cwd(), './src-celaris')
  const buildPath = [resolve(srcCelarisPath, 'build'), resolve(srcCelarisPath, 'test')]

  console.log(`Watching: ${srcCelarisPath}`)
  console.log(`Ignoring: ${buildPath}`)

  // Watch for changes in src-celaris (excluding build directory)
  watcher = chokidar.watch(srcCelarisPath, { ignored: buildPath, persistent: true })

  watcher
    // .on('add', (filePath) => console.log(`File added: ${filePath}`))
    .on('change', async (filePath) => {
      console.log(`File changed: ${path}`)
      if (buildTimeout) clearTimeout(buildTimeout)
      buildTimeout = setTimeout(() => {
        buildAndStartCpp()
      }, 500) // Wait 500ms after the last change
    })
    // .on('unlink', (filePath) => console.log(`File removed: ${filePath}`))
    .on('ready', () => console.log(`Initial scan complete. Watching for changes in ${srcCelarisPath} while ignoring ${buildPath}.`))
    .on('error', (error) => console.error(`Watcher error: ${error}`))

  process.on('SIGINT', cleanUp)
  process.on('SIGTERM', cleanUp)
}
