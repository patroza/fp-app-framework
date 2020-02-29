import { RecordNotFound } from "@fp-app/framework"
import { err, ok, AsyncResult } from "@fp-app/fp-ts-extensions"
import { getFilename } from "./RecordContext"
import { deleteFile, exists, readFile, writeFile } from "./utils"

const deleteReadContextEntry = async (type: string, id: string) => {
  // Somehow this return an empty object, so we void it here.
  await deleteFile(getFilename(type, id))
}

const createOrUpdateReadContextEntry = <T>(type: string, id: string, value: T) =>
  writeFile(getFilename(type, id), JSON.stringify(value))

const readReadContextEntry = async <T>(type: string, id: string) => {
  const json = await readFile(getFilename(type, id), { encoding: "utf-8" })
  return JSON.parse(json) as T
}

export default class ReadContext<T> {
  constructor(readonly type: string) {
    this.type = `read-${type}`
  }

  readonly create = (id: string, value: T) =>
    createOrUpdateReadContextEntry(this.type, id, value)
  readonly delete = (id: string) => deleteReadContextEntry(this.type, id)
  readonly read = (id: string): AsyncResult<T, RecordNotFound> => async () => {
    const filePath = getFilename(this.type, id)
    if (!(await exists(filePath))) {
      return err(new RecordNotFound(this.type, id))
    }
    const r = await readReadContextEntry<T>(this.type, id)
    return ok(r)
  }
}
