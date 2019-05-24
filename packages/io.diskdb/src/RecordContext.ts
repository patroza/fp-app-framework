import { RecordContext, success } from "@fp-app/framework"
import { assert, ConnectionError, CouldNotAquireDbLockError, DbError, OptimisticLockError, RecordNotFound } from "@fp-app/framework"
import { err, flatMap, liftType, map, mapErr, ok, PipeFunctionN, Result, startWithVal } from "@fp-app/framework"
import { lock } from "proper-lockfile"
import { deleteFile, exists, readFile, writeFile } from "./utils"

// tslint:disable-next-line:max-classes-per-file
export default class DiskRecordContext<T extends DBRecord> implements RecordContext<T> {
  private cache = new Map<string, CachedRecord<T>>()
  private removals: T[] = []

  constructor(
    private readonly type: string,
    private readonly serializer: (record: T) => string,
    private readonly deserializer: (serialized: string) => Result<T, never>,
  ) { }

  readonly add = (record: T) => {
    assert.isNotNull({ record })
    this.cache.set(record.id, { version: 0, data: record })
  }

  readonly remove = (record: T) => {
    assert.isNotNull({ record })
    this.removals.push(record)
  }

  readonly load = async (id: string): Promise<Result<T, DbError>> => {
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
  readonly intGetAndClearEvents = () => {
    let events: any[] = []
    const items = [...this.cache.values()].map(x => x.data).concat(this.removals)
    items.forEach(r => {
      const rDataAny = r as any
      events = events.concat(rDataAny._EVENTS)
      rDataAny._EVENTS = []
    })
    return events
  }

  readonly intSave = (
    forEachSave?: (item: T) => Promise<Result<void, DbError>>,
    forEachDelete?: (item: T) => Promise<Result<void, DbError>>,
  ): Promise<Result<void, DbError>> =>
    this.handleDeletions(forEachDelete).pipe(
      flatMap(() => this.handleInsertionsAndUpdates(forEachSave)),
    )

  private readonly handleDeletions = async (forEachDelete?: (item: T) => Promise<Result<void, DbError>>): Promise<Result<void, DbError>> => {
    for (const e of this.removals) {
      const r = await this.deleteRecord(e)
      if (r.isErr()) {
        return r
      }
      if (forEachDelete) {
        const rEs = await forEachDelete(e)
        if (rEs.isErr()) {
          return rEs
        }
      }
      this.cache.delete(e.id)
    }
    return success()
  }

  private readonly handleInsertionsAndUpdates = async (forEachSave?: (item: T) => Promise<Result<void, DbError>>): Promise<Result<void, DbError>> => {
    for (const e of this.cache.entries()) {
      const r = await this.saveRecord(e[1].data)
      if (r.isErr()) {
        return r
      }
      if (forEachSave) {
        const rEs = await forEachSave(e[1].data)
        if (rEs.isErr()) {
          return rEs
        }
      }
    }
    return success()

  }

  private readonly saveRecord = async (record: T): Promise<Result<void, DbError>> => {
    assert.isNotNull({ record })
    const cachedRecord = this.cache.get(record.id)!

    if (!cachedRecord.version) {
      await this.actualSave(record, cachedRecord.version)
      return success()
    }

    return await lockRecordOnDisk(this.type, record.id, () =>
      tryReadFromDb(this.type, record.id).pipe(
        flatMap(async (storedSerialized): Promise<Result<void, DbError>> => {
          const { version } = JSON.parse(storedSerialized) as SerializedDBRecord
          if (version !== cachedRecord.version) {
            return err(new OptimisticLockError(this.type, record.id))
          }
          await this.actualSave(record, version)
          return success()
        }),
      ))
  }

  private readonly deleteRecord = async (record: T): Promise<Result<void, DbError>> => {
    assert.isNotNull({ record })
    return await lockRecordOnDisk(this.type, record.id, () =>
      startWithVal(void 0)<DbError>().pipe(map(() => deleteFile(getFilename(this.type, record.id)))),
    )
  }

  private readonly actualSave = async (record: T, version: number) => {
    const data = this.serializer(record)

    const serialized = JSON.stringify({ version: version + 1, data })
    await writeFile(getFilename(this.type, record.id), serialized, { encoding: "utf-8" })
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
    return ok(await lock(getFilename(type, id)))
  } catch (er) {
    return err(new CouldNotAquireDbLockError(type, id, er))
  }
}

const tryReadFromDb = async (type: string, id: string): Promise<Result<string, DbError>> => {
  try {
    const filePath = getFilename(type, id)
    if (!await exists(filePath)) { return err(new RecordNotFound(type, id)) }
    return ok(await readFile(filePath, { encoding: "utf-8" }))
  } catch (err) {
    return err(new ConnectionError(err))
  }
}

export const getFilename = (type: string, id: string) => `./data/${type}-${id}.json`
