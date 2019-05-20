jest.mock('fp-app-framework/infrastructure/executePostCommitHandlers')

import { CombinedValidationError, ValidationError } from 'fp-app-framework/errors'
import { RecordNotFound } from 'fp-app-framework/infrastructure/errors'
import executePostCommitHandlers from 'fp-app-framework/infrastructure/executePostCommitHandlers'
import { logger, setLogger } from 'fp-app-framework/utils'
import { Err, Ok } from 'fp-app-framework/utils/neverthrow-extensions'
import createRoot from '../root'
import changeTrainTrip, { StateProposition } from './usecases/changeTrainTrip'
import createTrainTrip from './usecases/createTrainTrip'
import deleteTrainTrip from './usecases/deleteTrainTrip'
import getTrainTrip from './usecases/getTrainTrip'
import lockTrainTrip from './usecases/lockTrainTrip'
import registerCloud from './usecases/registerCloud'

let trainTripId: string
let executePostCommitHandlersMock: jest.Mock<ReturnType<typeof executePostCommitHandlers>>

let root: ReturnType<typeof createRoot>

// cls helpers
const bind = <T>(cb: (...args: any[]) => Promise<T>) => (...args: any[]) => {
  root = createRoot()
  return root.setupRootContext<T>(() => cb(args))
}

// Silence logger
const noop = () => void 0
setLogger(({
  debug: noop,
  error: noop,
  log: noop,
  warn: noop,
}))

beforeEach(bind(async () => {
  executePostCommitHandlersMock = jest.fn()
  const aAny = (executePostCommitHandlers as any)
  aAny.mockReturnValue(executePostCommitHandlersMock)
  executePostCommitHandlersMock.mockClear()
  const templateId = 'template-id1'

  const result = await root.getRequestHandler(createTrainTrip)({
    pax: { adults: 2, children: 0, babies: 0, infants: 0, teenagers: 0 },
    startDate: '2020-01-01',
    templateId,
  })

  trainTripId = result._unsafeUnwrap()
  expect(executePostCommitHandlersMock).toBeCalledTimes(1)
  executePostCommitHandlersMock.mockClear()
}))

describe('get', () => {
  it('works', bind(async () => {
    const result = await root.getRequestHandler(getTrainTrip)({ trainTripId })

    expect(result).toBeInstanceOf(Ok)
    // We don't want to leak accidentally domain objects
    expect(result._unsafeUnwrap()).toEqual({
      allowUserModification: true,
      createdAt: expect.any(Date),
      id: expect.any(String),
      pax: { adults: 2, babies: 0, children: 0, infants: 0, teenagers: 0 },
      startDate: expect.any(Date),
      travelClass: 'second',
      travelClasss: [{ templateId: 'template-id1', name: 'second' }, { templateId: 'template-id2', name: 'first' }],
    })

    logger.log(result._unsafeUnwrap())
    expect(executePostCommitHandlersMock).toBeCalledTimes(0)
  }))
})

describe('propose new state', () => {
  it('changes state accordingly', bind(async () => {
    const state: StateProposition = {
      pax: { adults: 2, babies: 2, children: 1, infants: 1, teenagers: 0 },
      startDate: '2030-01-01T00:00:00.000Z',
      travelClass: 'first',
    }

    const result = await root.getRequestHandler(changeTrainTrip)({ trainTripId, ...state })
    const newTrainTripResult = await root.getRequestHandler(getTrainTrip)({ trainTripId })

    expect(result).toBeInstanceOf(Ok)
    expect(newTrainTripResult).toBeInstanceOf(Ok)
    // We don't want to leak accidentally domain objects
    expect(result._unsafeUnwrap()).toBe(void 0)
    const r = newTrainTripResult._unsafeUnwrap()
    expect(r.travelClass).toBe(state.travelClass)
    expect(r.startDate).toEqual(new Date(state.startDate!))
    expect(r.pax).toEqual(state.pax)
    expect(executePostCommitHandlersMock).toBeCalledTimes(1)
    logger.log(r)
  }))

  it('errors on non existent travel class', bind(async () => {
    const state: StateProposition = { travelClass: 'business' }

    const r = await root.getRequestHandler(changeTrainTrip)({ trainTripId, ...state })

    expect(r.isErr()).toBe(true)
    const error = r._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe('business not found')
    expect(executePostCommitHandlersMock).toBeCalledTimes(0)
  }))

  it('errors on multiple invalid', bind(async () => {
    const state: StateProposition = { travelClass: 'bogus', pax: { children: 0 } as any, startDate: '2000-01-01' }

    const r = await root.getRequestHandler(changeTrainTrip)({ trainTripId, ...state })

    expect(r.isErr()).toBe(true)
    const error = r._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(CombinedValidationError)
    const cve = error as CombinedValidationError
    expect(cve.errors.length).toBe(3)
    expect(executePostCommitHandlersMock).toBeCalledTimes(0)
  }))
})

describe('able to lock the TrainTrip', () => {
  it('changes state accordingly', bind(async () => {
    const currentTrainTripResult = await root.getRequestHandler(getTrainTrip)({ trainTripId })

    const result = await root.getRequestHandler(lockTrainTrip)({ trainTripId })

    const newTrainTripResult = await root.getRequestHandler(getTrainTrip)({ trainTripId })
    expect(result).toBeInstanceOf(Ok)
    // We don't want to leak accidentally domain objects
    expect(result._unsafeUnwrap()).toBe(void 0)
    expect(currentTrainTripResult).toBeInstanceOf(Ok)
    expect(currentTrainTripResult._unsafeUnwrap().allowUserModification).toBe(true)
    expect(newTrainTripResult._unsafeUnwrap().allowUserModification).toBe(false)
    expect(executePostCommitHandlersMock).toBeCalledTimes(0)
  }))
})

describe('able to delete the TrainTrip', () => {
  it('deletes accordingly', bind(async () => {
    const currentTrainTripResult = await root.getRequestHandler(getTrainTrip)({ trainTripId })

    const result = await root.getRequestHandler(deleteTrainTrip)({ trainTripId })

    const newTrainTripResult = await root.getRequestHandler(getTrainTrip)({ trainTripId })
    expect(result).toBeInstanceOf(Ok)
    // We don't want to leak accidentally domain objects
    expect(result._unsafeUnwrap()).toBe(void 0)
    expect(currentTrainTripResult).toBeInstanceOf(Ok)
    expect(currentTrainTripResult._unsafeUnwrap().allowUserModification).toBe(true)
    expect(newTrainTripResult).toBeInstanceOf(Err)
    expect(newTrainTripResult._unsafeUnwrapErr()).toBeInstanceOf(RecordNotFound)
    expect(executePostCommitHandlersMock).toBeCalledTimes(0)
  }))
})

describe('register Cloud', () => {
  it('works', bind(async () => {
    const result = await root.getRequestHandler(registerCloud)({ trainTripId })

    expect(result).toBeInstanceOf(Ok)
    expect(result._unsafeUnwrap()).toBe(void 0)
    expect(executePostCommitHandlersMock).toBeCalledTimes(0)
  }))
})
