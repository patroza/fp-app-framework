import fs from 'fs'
import { lock } from 'proper-lockfile'
import { promisify } from 'util'
import assert from '../utils/assert'
import { err, flatMap, liftType, map, mapErr, ok, PipeFunctionN, Result, startWithVal } from '../utils/neverthrow-extensions'
import { RecordContext } from './context.base'
import { ConnectionError, DbError, RecordNotFound } from './errors'

// tslint:disable-next-line:max-classes-per-file
export class DiskRecordContext<T extends DBRecord> implements RecordContext<T> {
  private cache = new Map<string, CachedRecord<T>>()
  private removals: T[] = []

  constructor(
    private readonly type: string,
    private readonly serializer: (record: T) => string,
    private readonly deserializer: (serialized: string) => Result<T, never>,
  ) { }

  public add = (record: T) => {
    assert.isNotNull({ record })
    this.cache.set(record.id, { version: 0, data: record })
  }

  public remove = (record: T) => {
    assert.isNotNull({ record })
    this.removals.push(record)
  }

  public load = async (id: string): Promise<Result<T, DbError>> => {
    assert.isNotNull({ id })
    const cachedRecord = this.cache.get(id)
    if (cachedRecord) { return ok(cachedRecord.data) }
    return await tryReadFromDb(this.type, id)
      .pipe(
        map(serializedStr => JSON.parse(serializedStr) as SerializedDBRecord),
        flatMap(({ version, data }) => this.deserializer(data).pipe(map(dd => ({ version, data: dd })))),
        map(({ version, data }) => {
          this.cache.set(id, { version, data })
          return data
        }),
      )
  }

  // Internal
  public intGetAndClearEvents = () => {
    let events: any[] = []
    const items = [...this.cache.values()]
    items.forEach(r => {
      const rDataAny = (r.data as any)
      events = events.concat(rDataAny._EVENTS)
      rDataAny._EVENTS = []
    })
    return events
  }

  public intSave = async (): Promise<Result<void, DbError>> => {
    for (const e of this.removals) {
      const r = await this.deleteRecord(e)
      if (r.isErr()) {
        return r
      }
      this.cache.delete(e.id)
    }
    for (const e of this.cache.entries()) {
      const r = await this.saveRecord(e[1].data)
      if (r.isErr()) {
        return r
      }
    }
    return ok(void 0)
  }

  private saveRecord = async (record: T): Promise<Result<void, DbError>> => {
    assert.isNotNull({ record })
    const cachedRecord = this.cache.get(record.id)!

    if (!cachedRecord.version) {
      await this.actualSave(record, cachedRecord.version)
      return ok(void 0)
    }

    return await lockRecordOnDisk(this.type, record.id, () =>
      tryReadFromDb(this.type, record.id).pipe(
        flatMap(async (storedSerialized): Promise<Result<void, DbError>> => {
          const { version } = JSON.parse(storedSerialized) as SerializedDBRecord
          if (version !== cachedRecord.version) {
            return err(new OptimisticLockError(this.type, record.id))
          }
          await this.actualSave(record, version)
          return ok(void 0)
        }),
      ))
  }

  private deleteRecord = async (record: T): Promise<Result<void, DbError>> => {
    assert.isNotNull({ record })
    return await lockRecordOnDisk(this.type, record.id, () =>
      startWithVal<DbError>()(void 0).pipe(map(() => deleteFile(getFn(this.type, record.id)))),
    )
  }

  private actualSave = async (record: T, version: number) => {
    if (!await exists('./data')) { await mkdir('./data') }
    const data = this.serializer(record)

    const serialized = JSON.stringify({ version: version + 1, data })
    await writeFile(getFn(this.type, record.id), serialized, { encoding: 'utf-8' })
    this.cache.set(record.id, { version, data: record })
  }
}

interface DBRecord { id: string }
interface SerializedDBRecord { version: number, data: string }
interface CachedRecord<T> { version: number, data: T }

const lockRecordOnDisk = <T>(type: string, id: string, cb: PipeFunctionN<T, DbError>) =>
  tryLock(type, id)
    .pipe(
      mapErr(liftType<DbError>()),
      flatMap(async release => {
        try {
          return await cb()
        } finally {
          await release()
        }
      }),
    )

const tryLock = async (type: string, id: string): Promise<Result<() => Promise<void>, CouldNotAquireDbLockError>> => {
  try {
    return ok(await lock(getFn(type, id)))
  } catch (er) {
    return err(new CouldNotAquireDbLockError(type, id, er))
  }
}

const tryReadFromDb = async (type: string, id: string): Promise<Result<string, DbError>> => {
  try {
    const filePath = getFn(type, id)
    if (!await exists(filePath)) { return err(new RecordNotFound(id, type)) }
    return ok(await readFile(filePath, { encoding: 'utf-8' }))
  } catch (err) {
    return err(new ConnectionError(err))
  }
}

const getFn = (type: string, id: string) => `./data/${type}-${id}.json`

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const mkdir = promisify(fs.mkdir)
const deleteFile = promisify(fs.unlink)

// tslint:disable-next-line:max-classes-per-file
export class CouldNotAquireDbLockError extends Error {
  constructor(public readonly type: string, public readonly id: string, public readonly error: Error) {
    super(`Couldn't lock db record ${type}: ${id}`)
  }
}

// tslint:disable-next-line:max-classes-per-file
export class OptimisticLockError extends Error {
  constructor(public readonly type: string, public readonly id: string) {
    super(`Existing ${type} ${id} record changed`)
  }
}
