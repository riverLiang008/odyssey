import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
export async function inventory(directory, prefix = '') {
  const result = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name, absolute = path.join(directory,entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symlink in release input: ${name}`)
    if (entry.isDirectory()) result.push(...await inventory(absolute,`${name}/`))
    else { const bytes = await readFile(absolute); result.push({path:name,bytes:bytes.length,sha256:sha256(bytes)}) }
  }
  return result
}
export async function sourceInputs(root) {
  const directories = ['apps/web/src','packages/schemas/src','packages/design-tokens/src','doc/product/cases/first-case-knowledge-qa','doc/assets/brand','scripts']
  const files = []
  for (const directory of directories) files.push(...(await inventory(path.join(root,directory))).map(file => ({...file,path:`${directory}/${file.path}`})))
  for (const name of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','apps/web/package.json','apps/web/vite.config.ts','apps/web/tsconfig.app.json','doc/deployment/public-demo-release-guide.md']) {
    files.push({path:name,sha256:sha256(await readFile(path.join(root,name)))})
  }
  return {files,digest:sha256(JSON.stringify(files))}
}
