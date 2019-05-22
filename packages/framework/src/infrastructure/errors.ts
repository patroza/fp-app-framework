// tslint:disable:max-classes-per-file

import { ErrorBase } from '../errors'
import assert from '../utils/assert'

export type DbError = RecordNotFound | ConnectionError | OptimisticLockError | CouldNotAquireDbLockError
export type ApiError = RecordNotFound | ConnectionError

export class ConnectionError extends ErrorBase {
  readonly name = 'ConnectionError'
  constructor(readonly error: Error) {
    super('A connection error ocurred')
  }
}

export class RecordNotFound extends ErrorBase {
  readonly name = 'RecordNotFound'
  constructor(readonly type: string, readonly id: string) {
    super(`The ${type} with ${id} was not found`)
    assert.isNotNull({ id, type })
  }
}

export class CouldNotAquireDbLockError extends Error {
  constructor(readonly type: string, readonly id: string, readonly error: Error) {
    super(`Couldn't lock db record ${type}: ${id}`)
    assert.isNotNull({ id, type })
  }
}

export class OptimisticLockError extends Error {
  constructor(readonly type: string, readonly id: string) {
    super(`Existing ${type} ${id} record changed`)
    assert.isNotNull({ id, type })
  }
}
