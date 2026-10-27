import { deflateRawSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Small ZIP writer for the reviewed static assets. No shell or external zip runtime.
const crc32 = buffer => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
export async function zipDirectory(directory, files, destination) {
  const entries = [], central = []
  let offset = 0
  for (const { path: name } of files) {
    const filename = Buffer.from(name, 'utf8'), source = await readFile(path.join(directory, name))
    const compressed = deflateRawSync(source), checksum = crc32(source)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6); local.writeUInt16LE(8,8); local.writeUInt16LE(0x21,12)
    local.writeUInt32LE(checksum,14); local.writeUInt32LE(compressed.length,18); local.writeUInt32LE(source.length,22); local.writeUInt16LE(filename.length,26)
    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20,4); header.writeUInt16LE(20,6); header.writeUInt16LE(0x800,8); header.writeUInt16LE(8,10); header.writeUInt16LE(0x21,14)
    header.writeUInt32LE(checksum,16); header.writeUInt32LE(compressed.length,20); header.writeUInt32LE(source.length,24); header.writeUInt16LE(filename.length,28); header.writeUInt32LE(offset,42)
    entries.push(local, filename, compressed); central.push(header,filename)
    offset += local.length + filename.length + compressed.length
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10)
  end.writeUInt32LE(index.length,12); end.writeUInt32LE(offset,16)
  await writeFile(destination, Buffer.concat([...entries,index,end]))
}
