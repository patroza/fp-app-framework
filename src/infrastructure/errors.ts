import { ErrorBase } from '../errors'
import assert from '../utils/assert'
import { CouldNotAquireDbLockError, OptimisticLockError } from './diskdb'

export type DbError = RecordNotFound | ConnectionError | OptimisticLockError | CouldNotAquireDbLockError
export type ApiError = RecordNotFound | ConnectionError

export class ConnectionError extends ErrorBase {
  readonly name = 'ConnectionError'
  constructor(readonly error: Error) {
    super('A connection error ocurred')
  }
}

// tslint:disable-next-line:max-classes-per-file
export class RecordNotFound extends ErrorBase {
  readonly name = 'RecordNotFound'
  constructor(readonly id: string, readonly type: string) {
    super(`The ${type} with ${id} was not found`)
    assert.isNotNull({id, type})
  }
}
