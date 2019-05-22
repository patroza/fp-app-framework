import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const mkdir = promisify(fs.mkdir)
const deleteFile = promisify(fs.unlink)

export {
  readFile,
  writeFile,
  exists,
  mkdir,
  deleteFile,
}
