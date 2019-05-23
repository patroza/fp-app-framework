import { getFilename } from "./RecordContext"
import { deleteFile, readFile, writeFile } from "./utils"

const deleteReadContextEntry = (type: string, id: string) => {
  return deleteFile(getFilename(`read-${type}`, id))
}

const createOrUpdateReadContextEntry = <T>(type: string, id: string, value: T) => {
  return writeFile(getFilename(`read-${type}`, id), JSON.stringify(value))
}

const readReadContextEntry = async <T>(type: string, id: string) => {
  const json = await readFile(getFilename(`read-${type}`, id), { encoding: "utf-8" })
  return JSON.parse(json) as T
}

export default class ReadContext<T> {
  constructor(readonly type: string) { }
  readonly create = (id: string, value: T) => createOrUpdateReadContextEntry(this.type, id, value)
  readonly delete = (id: string) => deleteReadContextEntry(this.type, id)
  readonly read = (id: string) => readReadContextEntry<T>(this.type, id)
}

export {
  createOrUpdateReadContextEntry,
  deleteReadContextEntry,
  readReadContextEntry,
}
