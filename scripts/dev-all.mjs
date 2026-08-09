import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
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
const children = new Set()
let stopping = false

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
  console.log('PostgreSQL and MinIO are still running. Use `pnpm dev:down` to stop them.')
  process.exit(exitCode)
}

async function startAll() {
  await ensureDockerIsReady()
  console.log('Starting PostgreSQL and MinIO...')
  await run('docker', ['compose', ...composeFiles, 'up', '-d', '--wait'])

  console.log(`Applying database migrations on PostgreSQL port ${postgresPort}...`)
  await run('uv', ['run', 'alembic', 'upgrade', 'head'], {
    cwd: apiDir,
    env: { ...process.env, ODYSSEY_DATABASE_URL: databaseUrl },
  })

  console.log('Starting API and Web...')
  start('pnpm', ['--filter', '@odyssey/web', 'dev', '--host', '127.0.0.1'], { cwd: rootDir })
  start('uv', ['run', 'uvicorn', 'odyssey_api.main:app', '--reload'], {
    cwd: apiDir,
    env: { ...process.env, ODYSSEY_DATABASE_URL: databaseUrl },
  })

  console.log('\nOdyssey is starting:')
  console.log('  Web:       http://127.0.0.1:5173')
  console.log('  API:       http://127.0.0.1:8000/api/v1/health')
  console.log('  API docs:  http://127.0.0.1:8000/docs')
  console.log('  MinIO:     http://127.0.0.1:9001')
  console.log('\nPress Ctrl+C to stop Web and API.')
}

async function stopInfrastructure() {
  console.log('Stopping PostgreSQL and MinIO...')
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
