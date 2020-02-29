import {
  ConnectionError,
  CouldNotAquireDbLockError,
  DbError,
  Event,
  OptimisticLockError,
  RecordContext,
  RecordNotFound,
} from "@fp-app/framework"
import {
  err,
  liftType,
  ok,
  PipeFunctionN,
  startWithVal,
  success,
  pipe,
  AsyncResult,
  E,
  TE,
  isErr,
  okTask,
} from "@fp-app/fp-ts-extensions"
import { lock } from "proper-lockfile"
import { deleteFile, exists, readFile, writeFile } from "./utils"

// tslint:disable-next-line:max-classes-per-file
export default class DiskRecordContext<T extends DBRecord> implements RecordContext<T> {
  private cache = new Map<string, CachedRecord<T>>()
  private removals: T[] = []

  constructor(
    private readonly type: string,
    private readonly serializer: (record: T) => string,
    private readonly deserializer: (serialized: string) => T,
  ) {}

  readonly add = (record: T) => {
    this.cache.set(record.id, { version: 0, data: record })
  }

  readonly remove = (record: T) => {
    this.removals.push(record)
  }

  readonly load = (id: string): AsyncResult<T, DbError> => {
    const cachedRecord = this.cache.get(id)
    if (cachedRecord) {
      return okTask(cachedRecord.data)
    }
    return pipe(
      tryReadFromDb(this.type, id),
      TE.map(serializedStr => JSON.parse(serializedStr) as SerializedDBRecord),
      TE.map(({ data, version }) => ({ data: this.deserializer(data), version })),
      TE.map(({ data, version }) => {
        this.cache.set(id, { version, data })
        return data
      }),
    )
  }

  // Internal
  readonly intGetAndClearEvents = () => {
    const items = [...this.cache.values()].map(x => x.data).concat(this.removals)
    return items.reduce(
      (prev, cur) => prev.concat(cur.intGetAndClearEvents()),
      [] as Event[],
    )
  }

  readonly intSave = (
    forEachSave?: (item: T) => AsyncResult<void, DbError>,
    forEachDelete?: (item: T) => AsyncResult<void, DbError>,
  ): AsyncResult<void, DbError> =>
    pipe(
      this.handleDeletions(forEachDelete),
      TE.chain(() => this.handleInsertionsAndUpdates(forEachSave)),
    )

  private readonly handleDeletions = (
    forEachDelete?: (item: T) => AsyncResult<void, DbError>,
  ): AsyncResult<void, DbError> => async () => {
    for (const e of this.removals) {
      const r = await this.deleteRecord(e)()
      if (isErr(r)) {
        return r
      }
      if (forEachDelete) {
        const rEs = await forEachDelete(e)()
        if (isErr(rEs)) {
          return rEs
        }
      }
      this.cache.delete(e.id)
    }
    return success()
  }

  private readonly handleInsertionsAndUpdates = (
    forEachSave?: (item: T) => AsyncResult<void, DbError>,
  ): AsyncResult<void, DbError> => async () => {
    for (const e of this.cache.entries()) {
      const r = await this.saveRecord(e[1].data)()
      if (isErr(r)) {
        return r
      }
      if (forEachSave) {
        const rEs = await forEachSave(e[1].data)()
        if (isErr(rEs)) {
          return rEs
        }
      }
    }
    return success()
  }

  private readonly saveRecord = (record: T): AsyncResult<void, DbError> => async () => {
    const cachedRecord = this.cache.get(record.id)!

    if (!cachedRecord.version) {
      await this.actualSave(record, cachedRecord.version)
      return success()
    }

    return await lockRecordOnDisk(this.type, record.id, () =>
      pipe(
        tryReadFromDb(this.type, record.id),
        TE.chain(
          (storedSerialized): AsyncResult<void, DbError> => async () => {
            const { version } = JSON.parse(storedSerialized) as SerializedDBRecord
            if (version !== cachedRecord.version) {
              return err(new OptimisticLockError(this.type, record.id))
            }
            await this.actualSave(record, version)
            return success()
          },
        ),
      ),
    )()
  }

  private readonly deleteRecord = (record: T): AsyncResult<void, DbError> =>
    lockRecordOnDisk(this.type, record.id, () =>
      pipe(
        startWithVal(void 0)<DbError>(),
        TE.chain(() => async () =>
          E.right(await deleteFile(getFilename(this.type, record.id))),
        ),
      ),
    )

  private readonly actualSave = async (record: T, version: number) => {
    const data = this.serializer(record)

    const serialized = JSON.stringify({ version: version + 1, data })
    await writeFile(getFilename(this.type, record.id), serialized, {
      encoding: "utf-8",
    })
    this.cache.set(record.id, { version, data: record })
  }
}

interface DBRecord {
  id: string
  intGetAndClearEvents: () => Event[]
}
interface SerializedDBRecord {
  version: number
  data: string
}
interface CachedRecord<T> {
  version: number
  data: T
}

const lockRecordOnDisk = <T>(type: string, id: string, cb: PipeFunctionN<T, DbError>) =>
  pipe(
    tryLock(type, id),
    TE.mapLeft(liftType<DbError>()),
    TE.chain(release => async () => {
      try {
        return await cb()()
      } finally {
        await release()
      }
    }),
  )

const tryLock = (
  type: string,
  id: string,
): AsyncResult<() => Promise<void>, CouldNotAquireDbLockError> => async () => {
  try {
    return ok(await lock(getFilename(type, id)))
  } catch (er) {
    return err(new CouldNotAquireDbLockError(type, id, er))
  }
}

const tryReadFromDb = (
  type: string,
  id: string,
): AsyncResult<string, DbError> => async () => {
  try {
    const filePath = getFilename(type, id)
    if (!(await exists(filePath))) {
      return err(new RecordNotFound(type, id))
    }
    return ok(await readFile(filePath, { encoding: "utf-8" }))
  } catch (err) {
    return err(new ConnectionError(err))
  }
}

export const getFilename = (type: string, id: string) => `./data/${type}-${id}.json`
