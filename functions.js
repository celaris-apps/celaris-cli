import { spawn } from 'child_process'

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

/*==================== EXPORTS ====================*/

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
export async function runDev(options) {
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
}
