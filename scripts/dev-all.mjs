import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createConnection, createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const apiDir = join(rootDir, 'apps', 'api')
const composeFile = join(rootDir, 'infrastructure', 'compose.yaml')
const localComposeFile = join(rootDir, 'infrastructure', 'compose.local.yaml')
const useLocalCompose = existsSync(localComposeFile)
const composeFiles = ['-f', composeFile]

if (useLocalCompose) {
  composeFiles.push('-f', localComposeFile)
}

const postgresPort = useLocalCompose ? '55432' : '5432'
const databaseUrl =
  process.env.ODYSSEY_DATABASE_URL ??
  `postgresql+asyncpg://odyssey:odyssey@127.0.0.1:${postgresPort}/odyssey`
const apiPort = Number.parseInt(process.env.ODYSSEY_DEV_API_PORT ?? '8000', 10)
const webPort = Number.parseInt(process.env.ODYSSEY_DEV_WEB_PORT ?? '5173', 10)
const children = new Set()
const runtimeDir = join(rootDir, '.odyssey-dev')
const stateFile = join(runtimeDir, 'dev-all.json')
const stateVersion = 1
let stopping = false
let controlServer
let controlToken
let ownsStateFile = false
let infrastructureStarted = false

function commandInvocation(command, args) {
  if (command === 'pnpm' && process.env.npm_execpath) {
    return { executable: process.execPath, args: [process.env.npm_execpath, ...args] }
  }

  return { executable: command, args }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const invocation = commandInvocation(command, args)
    const child = spawn(invocation.executable, invocation.args, {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
      ...options,
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} exited with ${signal ?? `code ${code}`}`))
    })
  })
}

function start(command, args, options = {}) {
  const invocation = commandInvocation(command, args)
  const child = spawn(invocation.executable, invocation.args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    ...options,
  })

  children.add(child)
  child.once('exit', (code, signal) => {
    children.delete(child)
    if (!stopping) {
      console.error(`\n${command} stopped unexpectedly (${signal ?? `code ${code}`}).`)
      void shutdown(code || 1)
    }
  })
  child.once('error', (error) => {
    console.error(`Failed to start ${command}:`, error)
    void shutdown(1)
  })

  return child
}

function dockerIsReady() {
  return (
    spawnSync('docker', ['info'], {
      stdio: 'ignore',
      windowsHide: true,
    }).status === 0
  )
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readState() {
  if (!existsSync(stateFile)) return null
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'))
    if (state.version !== stateVersion || state.rootDir !== rootDir) return null
    return state
  } catch {
    return null
  }
}

function writeState(extra = {}) {
  mkdirSync(runtimeDir, { recursive: true })
  const nextState = {
    version: stateVersion,
    rootDir,
    orchestratorPid: process.pid,
    controlPort: controlServer?.address()?.port,
    controlToken,
    childPids: [...children].map((child) => child.pid).filter(Boolean),
    startedAt: new Date().toISOString(),
    ...extra,
  }
  const temporary = `${stateFile}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
  renameSync(temporary, stateFile)
}

function removeState() {
  const state = readState()
  if (ownsStateFile && (!state || state.orchestratorPid === process.pid)) {
    unlinkSync(stateFile)
  }
  try {
    rmSync(runtimeDir, { recursive: false })
  } catch {
    // Keep the directory when another diagnostic artifact exists.
  }
}

function claimStateFile() {
  mkdirSync(runtimeDir, { recursive: true })
  try {
    const descriptor = openSync(stateFile, 'wx')
    closeSync(descriptor)
    ownsStateFile = true
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error('Another dev:all command claimed the Odyssey runtime state.')
    }
    throw error
  }
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.unref()
    probe.once('error', () => resolve(false))
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      probe.close(() => resolve(true))
    })
  })
}

async function assertSingleInstance() {
  for (const [name, port] of [
    ['ODYSSEY_DEV_API_PORT', apiPort],
    ['ODYSSEY_DEV_WEB_PORT', webPort],
  ]) {
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`${name} must be a valid TCP port.`)
    }
  }
  const state = readState()
  if (state && processIsAlive(state.orchestratorPid)) {
    throw new Error(
      `Odyssey dev services are already running under PID ${state.orchestratorPid}. ` +
        'Run `pnpm dev:down` first.',
    )
  }
  if (existsSync(stateFile)) unlinkSync(stateFile)

  for (const [port, service] of [
    [apiPort, 'API'],
    [webPort, 'Web'],
  ]) {
    if (!(await portIsAvailable(port))) {
      throw new Error(
        `${service} port ${port} is already in use by an unmanaged process. ` +
          'Identify its PID before stopping it; dev:all will not stack another instance.',
      )
    }
  }
}

function startControlServer() {
  controlToken = randomUUID()
  controlServer = createServer((socket) => {
    socket.setEncoding('utf8')
    socket.once('data', (payload) => {
      let request
      try {
        request = JSON.parse(payload)
      } catch {
        socket.end('{"ok":false}\n')
        return
      }
      if (request.token !== controlToken || request.command !== 'shutdown') {
        socket.end('{"ok":false}\n')
        return
      }
      socket.end('{"ok":true}\n')
      void shutdown(0)
    })
  })
  return new Promise((resolve, reject) => {
    controlServer.once('error', reject)
    controlServer.listen(0, '127.0.0.1', resolve)
  })
}

async function ensureDockerIsReady() {
  if (dockerIsReady()) return

  if (process.platform !== 'win32') {
    throw new Error('Docker Engine is not running. Start Docker and run the command again.')
  }

  const dockerDesktop = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
  if (!existsSync(dockerDesktop)) {
    throw new Error('Docker Desktop is not installed or could not be found.')
  }

  console.log('Docker Desktop is not running; starting it now...')
  const dockerProcess = spawn(dockerDesktop, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  dockerProcess.unref()

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await delay(2_000)
    if (dockerIsReady()) return
  }

  throw new Error('Docker Desktop did not become ready within 120 seconds.')
}

function terminateProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
  } else {
    child.kill('SIGTERM')
  }
}

async function shutdown(exitCode = 0) {
  if (stopping) return
  stopping = true

  console.log('\nStopping Web and API...')
  for (const child of children) terminateProcessTree(child)
  children.clear()
  controlServer?.close()
  if (infrastructureStarted) {
    console.log('Stopping PostgreSQL and MinIO...')
    spawnSync('docker', ['compose', ...composeFiles, 'down'], {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })
  }
  removeState()
  process.exit(exitCode)
}

async function startAll() {
  await assertSingleInstance()
  claimStateFile()
  await startControlServer()
  writeState()
  await ensureDockerIsReady()
  console.log('Starting PostgreSQL and MinIO...')
  await run('docker', ['compose', ...composeFiles, 'up', '-d', '--wait'])
  infrastructureStarted = true

  console.log(`Applying database migrations on PostgreSQL port ${postgresPort}...`)
  await run('uv', ['run', 'alembic', 'upgrade', 'head'], {
    cwd: apiDir,
    env: { ...process.env, ODYSSEY_DATABASE_URL: databaseUrl },
  })

  console.log('Bootstrapping the configured development Workspace...')
  await run('uv', ['run', 'python', '-m', 'odyssey_api.bootstrap'], {
    cwd: apiDir,
    env: { ...process.env, ODYSSEY_DATABASE_URL: databaseUrl },
  })

  console.log('Starting API and Web...')
  start(
    'pnpm',
    ['--filter', '@odyssey/web', 'dev', '--host', '127.0.0.1', '--port', String(webPort)],
    { cwd: rootDir },
  )
  start('uv', [
    'run',
    'uvicorn',
    'odyssey_api.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    String(apiPort),
  ], {
    cwd: apiDir,
    env: { ...process.env, ODYSSEY_DATABASE_URL: databaseUrl },
  })
  writeState()

  console.log('\nOdyssey is starting:')
  console.log(`  Web:       http://127.0.0.1:${webPort}`)
  console.log(`  API:       http://127.0.0.1:${apiPort}/api/v1/health`)
  console.log(`  API docs:  http://127.0.0.1:${apiPort}/docs`)
  console.log('  MinIO:     http://127.0.0.1:9001')
  console.log('\nPress Ctrl+C or run `pnpm dev:down` in another terminal to stop everything.')
}

async function stopInfrastructure() {
  const state = readState()
  if (state && processIsAlive(state.orchestratorPid) && state.controlPort && state.controlToken) {
    await new Promise((resolve, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port: state.controlPort })
      socket.setTimeout(5_000)
      socket.once('connect', () => {
        socket.write(JSON.stringify({ command: 'shutdown', token: state.controlToken }))
      })
      socket.once('data', () => {
        socket.end()
        resolve()
      })
      socket.once('timeout', () => reject(new Error('Timed out contacting dev:all.')))
      socket.once('error', reject)
    })
    for (let attempt = 0; attempt < 50 && existsSync(stateFile); attempt += 1) {
      await delay(100)
    }
    if (existsSync(stateFile)) {
      throw new Error('dev:all did not finish shutting down within 5 seconds.')
    }
    console.log('Odyssey Web, API, PostgreSQL, and MinIO are stopped.')
    return
  }

  if (state?.childPids?.some(processIsAlive)) {
    throw new Error(
      'Found a stale state file with live child PIDs but no reachable orchestrator. ' +
        `Inspect ${stateFile} and the recorded commands before stopping them manually.`,
    )
  }
  if (existsSync(stateFile)) unlinkSync(stateFile)
  console.log('No managed Web/API instance is running; stopping infrastructure...')
  await run('docker', ['compose', ...composeFiles, 'down'])
}

process.on('SIGINT', () => void shutdown(0))
process.on('SIGTERM', () => void shutdown(0))

try {
  if (process.argv[2] === 'down') {
    await stopInfrastructure()
  } else {
    await startAll()
  }
} catch (error) {
  console.error('\nFailed to start Odyssey:', error instanceof Error ? error.message : error)
  await shutdown(1)
}
