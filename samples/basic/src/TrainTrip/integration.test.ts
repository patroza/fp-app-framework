/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock("@fp-app/framework/src/infrastructure/executePostCommitHandlers")

import { CustomerRequestedChangesDTO } from "@/resolveIntegrationEvent"
import {
  CombinedValidationError,
  executePostCommitHandlers,
  generateShortUuid,
  logger,
  noop,
  RecordNotFound,
  setLogger,
} from "@fp-app/framework"
import { Result, isErr, isOk } from "@fp-app/fp-ts-extensions"
import moment from "moment"
import createRoot from "../root"
import changeTrainTrip, { StateProposition } from "./usecases/changeTrainTrip"
import createTrainTrip from "./usecases/createTrainTrip"
import deleteTrainTrip from "./usecases/deleteTrainTrip"
import getTrainTrip from "./usecases/getTrainTrip"
import lockTrainTrip from "./usecases/lockTrainTrip"
import registerCloud from "./usecases/registerCloud"

let trainTripId: string
let executePostCommitHandlersMock: jest.Mock<ReturnType<
  typeof executePostCommitHandlers
>>

let root: ReturnType<typeof createRoot>

// cls helpers
const createRootAndBind = (cb: () => Promise<void>) => {
  root = createRoot()
  return root.setupRequestContext(cb)
}

// Silence logger
setLogger({
  debug: noop,
  error: noop,
  log: noop,
  warn: noop,
})

beforeEach(() =>
  createRootAndBind(async () => {
    await root.initialize()
    executePostCommitHandlersMock = jest.fn()
    const aAny = executePostCommitHandlers as any
    aAny.mockReturnValue(executePostCommitHandlersMock)
    executePostCommitHandlersMock.mockClear()
    const templateId = "template-id1"

    const result = await root.request(createTrainTrip, {
      pax: { adults: 2, children: 0, babies: 0, infants: 0, teenagers: 0 },
      startDate: moment()
        .add(1, "year")
        .format("YYYY-MM-DD"),
      templateId,
    })()

    trainTripId = unsafeUnwrap(result)
    // eslint-disable-next-line jest/no-standalone-expect
    expect(executePostCommitHandlersMock).toBeCalledTimes(1)
    executePostCommitHandlersMock.mockClear()
  }),
)

const unsafeUnwrap = <A, E>(e: Result<A, E>) => {
  if (isErr(e)) {
    throw new Error(JSON.stringify(e))
  }
  return e.right
}

const unsafeUnwrapErr = <A, E>(e: Result<A, E>) => {
  if (isOk(e)) {
    throw new Error(JSON.stringify(e))
  }
  return e.left
}

describe("usecases", () => {
  describe("get", () => {
    it("works", () =>
      createRootAndBind(async () => {
        const r = root.request(getTrainTrip, { trainTripId })
        const result = await r()

        expect(isOk(result)).toBe(true)
        // We don't want to leak accidentally domain objects
        expect(unsafeUnwrap(result)).toEqual({
          allowUserModification: true,
          createdAt: expect.any(String),
          id: expect.any(String),
          pax: { adults: 2, babies: 0, children: 0, infants: 0, teenagers: 0 },
          startDate: expect.any(String),
          travelClass: "second",
          travelClasses: [
            { templateId: "template-id1", name: "second" },
            { templateId: "template-id2", name: "first" },
          ],
        })

        logger.log(unsafeUnwrap(result))
        expect(executePostCommitHandlersMock).toBeCalledTimes(0)
      }))
  })

  describe("propose new state", () => {
    it("changes state accordingly", () =>
      createRootAndBind(async () => {
        const state: StateProposition = {
          pax: { adults: 2, babies: 2, children: 1, infants: 1, teenagers: 0 },
          startDate: "2030-01-01T00:00:00.000Z",
          travelClass: "first",
        }

        const result = await root.request(changeTrainTrip, { trainTripId, ...state })()
        const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })()

        expect(isOk(result)).toBe(true)
        expect(isOk(newTrainTripResult)).toBe(true)
        // We don't want to leak accidentally domain objects
        expect(unsafeUnwrap(result)).toBe(void 0)
        const r = unsafeUnwrap(newTrainTripResult)
        expect(r.travelClass).toBe(state.travelClass)
        expect(r.startDate).toEqual(state.startDate!)
        expect(r.pax).toEqual(state.pax)
        expect(executePostCommitHandlersMock).toBeCalledTimes(1)
        logger.log(r)
      }))

    it("errors on non existent travel class", () =>
      createRootAndBind(async () => {
        const state: StateProposition = { travelClass: "doesntexist" }

        const r = await root.request(changeTrainTrip, { trainTripId, ...state })()
        expect(isErr(r)).toBe(true)
        const error = unsafeUnwrapErr(r)
        expect(error).toBeInstanceOf(CombinedValidationError)
        expect(error.message).toBe(
          "travelClass: doesntexist is not a valid travel class name",
        )
        expect(executePostCommitHandlersMock).toBeCalledTimes(0)
      }))

    it("errors on multiple invalid", () =>
      createRootAndBind(async () => {
        const state: StateProposition = {
          travelClass: "bogus",
          pax: { children: 0 } as any,
          startDate: "2000-01-01",
        }

        const r = await root.request(changeTrainTrip, { trainTripId, ...state })()

        expect(isErr(r)).toBe(true)
        const error = unsafeUnwrapErr(r)
        expect(error).toBeInstanceOf(CombinedValidationError)
        const cve = error as CombinedValidationError
        expect(cve.errors.length).toBe(3)
        expect(executePostCommitHandlersMock).toBeCalledTimes(0)
      }))
  })

  describe("able to lock the TrainTrip", () => {
    it("locks traintrip accordingly", () =>
      createRootAndBind(async () => {
        const currentTrainTripResult = await root.request(getTrainTrip, {
          trainTripId,
        })()

        const result = await root.request(lockTrainTrip, { trainTripId })()

        const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })()
        expect(isOk(result)).toBe(true)
        // We don't want to leak accidentally domain objects
        expect(unsafeUnwrap(result)).toBe(void 0)
        expect(isOk(currentTrainTripResult)).toBe(true)
        expect(unsafeUnwrap(currentTrainTripResult).allowUserModification).toBe(true)
        expect(unsafeUnwrap(newTrainTripResult).allowUserModification).toBe(false)
        expect(executePostCommitHandlersMock).toBeCalledTimes(1)
      }))
  })

  describe("able to delete the TrainTrip", () => {
    it("deletes accordingly", () =>
      createRootAndBind(async () => {
        const currentTrainTripResult = await root.request(getTrainTrip, {
          trainTripId,
        })()

        const result = await root.request(deleteTrainTrip, { trainTripId })()

        const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })()
        expect(isOk(result)).toBe(true)
        // We don't want to leak accidentally domain objects
        expect(unsafeUnwrap(result)).toBe(void 0)
        expect(isOk(currentTrainTripResult)).toBe(true)
        expect(unsafeUnwrap(currentTrainTripResult).allowUserModification).toBe(true)
        expect(isErr(newTrainTripResult)).toBe(true)
        expect(unsafeUnwrapErr(newTrainTripResult)).toBeInstanceOf(RecordNotFound)
        expect(executePostCommitHandlersMock).toBeCalledTimes(0)
      }))
  })

  describe("register Cloud", () => {
    it("works", () =>
      createRootAndBind(async () => {
        const result = await root.request(registerCloud, { trainTripId })()
        expect(isOk(result)).toBe(true)
        expect(unsafeUnwrap(result)).toBe(void 0)
        expect(executePostCommitHandlersMock).toBeCalledTimes(0)
      }))
  })
})

describe("integration events", () => {
  describe("CustomerRequestedChanges", () => {
    it("locks the TrainTrip", () =>
      createRootAndBind(async () => {
        const p: CustomerRequestedChangesDTO = {
          payload: { trainTripId, itineraryId: "some-itinerary-id" },
          type: "CustomerRequestedChanges",
        }
        await root.publishInNewContext(JSON.stringify(p), generateShortUuid())

        const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })()
        expect(unsafeUnwrap(newTrainTripResult).allowUserModification).toBe(false)
      }))
  })
})
