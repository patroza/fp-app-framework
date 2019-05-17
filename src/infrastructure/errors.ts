import { ErrorBase } from '../errors'
import assert from '../utils/assert'
import { CouldNotAquireDbLockError, OptimisticLockError } from './diskdb'

export type DbError = RecordNotFound | ConnectionError | OptimisticLockError | CouldNotAquireDbLockError
export type ApiError = RecordNotFound | ConnectionError

export class ConnectionError extends ErrorBase {
  public readonly name = 'ConnectionError'
  constructor(public readonly error: Error) {
    super('A connection error ocurred')
  }
}

// tslint:disable-next-line:max-classes-per-file
export class RecordNotFound extends ErrorBase {
  public readonly name = 'RecordNotFound'
  constructor(public readonly id: string, public readonly type: string) {
    super(`The ${type} with ${id} was not found`)
    assert.isNotNull({id, type})
  }
}
