jest.mock("@fp-app/framework/src/infrastructure/executePostCommitHandlers")

import { CustomerRequestedChangesDTO } from "@/resolveIntegrationEvent"
import {
  CombinedValidationError, executePostCommitHandlers, generateShortUuid, InvalidStateError, logger, noop, RecordNotFound, setLogger,
} from "@fp-app/framework"
import { Err, Ok } from "@fp-app/neverthrow-extensions"
import createRoot from "../root"
import changeTrainTrip, { StateProposition } from "./usecases/changeTrainTrip"
import createTrainTrip from "./usecases/createTrainTrip"
import deleteTrainTrip from "./usecases/deleteTrainTrip"
import getTrainTrip from "./usecases/getTrainTrip"
import lockTrainTrip from "./usecases/lockTrainTrip"
import registerCloud from "./usecases/registerCloud"

let trainTripId: string
let executePostCommitHandlersMock: jest.Mock<ReturnType<typeof executePostCommitHandlers>>

let root: ReturnType<typeof createRoot>

// cls helpers
const createRootAndBind = (cb: () => Promise<void>) => {
  root = createRoot()
  return root.setupRequestContext(cb)
}

// Silence logger
setLogger(({
  debug: noop,
  error: noop,
  log: noop,
  warn: noop,
}))

beforeEach(() => createRootAndBind(async () => {
  await root.initialize()
  executePostCommitHandlersMock = jest.fn()
  const aAny = (executePostCommitHandlers as any)
  aAny.mockReturnValue(executePostCommitHandlersMock)
  executePostCommitHandlersMock.mockClear()
  const templateId = "template-id1"

  const result = await root.request(createTrainTrip, {
    pax: { adults: 2, children: 0, babies: 0, infants: 0, teenagers: 0 },
    startDate: "2020-01-01",
    templateId,
  })

  trainTripId = result._unsafeUnwrap()
  expect(executePostCommitHandlersMock).toBeCalledTimes(1)
  executePostCommitHandlersMock.mockClear()
}))

describe("usecases", () => {
  describe("get", () => {
    it("works", () => createRootAndBind(async () => {
      const result = await root.request(getTrainTrip, { trainTripId })

      expect(result).toBeInstanceOf(Ok)
      // We don't want to leak accidentally domain objects
      expect(result._unsafeUnwrap()).toEqual({
        allowUserModification: true,
        createdAt: expect.any(String),
        id: expect.any(String),
        pax: { adults: 2, babies: 0, children: 0, infants: 0, teenagers: 0 },
        startDate: expect.any(String),
        travelClass: "second",
        travelClasss: [{ templateId: "template-id1", name: "second" }, { templateId: "template-id2", name: "first" }],
      })

      logger.log(result._unsafeUnwrap())
      expect(executePostCommitHandlersMock).toBeCalledTimes(0)
    }),
    )
  })

  describe("propose new state", () => {
    it("changes state accordingly", () => createRootAndBind(async () => {
      const state: StateProposition = {
        pax: { adults: 2, babies: 2, children: 1, infants: 1, teenagers: 0 },
        startDate: "2030-01-01T00:00:00.000Z",
        travelClass: "first",
      }

      const result = await root.request(changeTrainTrip, { trainTripId, ...state })
      const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })

      expect(result).toBeInstanceOf(Ok)
      expect(newTrainTripResult).toBeInstanceOf(Ok)
      // We don't want to leak accidentally domain objects
      expect(result._unsafeUnwrap()).toBe(void 0)
      const r = newTrainTripResult._unsafeUnwrap()
      expect(r.travelClass).toBe(state.travelClass)
      expect(r.startDate).toEqual(state.startDate!)
      expect(r.pax).toEqual(state.pax)
      expect(executePostCommitHandlersMock).toBeCalledTimes(1)
      logger.log(r)
    }))

    it("errors on non existent travel class", () => createRootAndBind(async () => {
      const state: StateProposition = { travelClass: "business" }

      const r = await root.request(changeTrainTrip, { trainTripId, ...state })

      expect(r.isErr()).toBe(true)
      const error = r._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(InvalidStateError)
      expect(error.message).toBe("business not available currently")
      expect(executePostCommitHandlersMock).toBeCalledTimes(0)
    }))

    it("errors on multiple invalid", () => createRootAndBind(async () => {
      const state: StateProposition = { travelClass: "bogus", pax: { children: 0 } as any, startDate: "2000-01-01" }

      const r = await root.request(changeTrainTrip, { trainTripId, ...state })

      expect(r.isErr()).toBe(true)
      const error = r._unsafeUnwrapErr()
      expect(error).toBeInstanceOf(CombinedValidationError)
      const cve = error as CombinedValidationError
      expect(cve.errors.length).toBe(3)
      expect(executePostCommitHandlersMock).toBeCalledTimes(0)
    }))
  })

  describe("able to lock the TrainTrip", () => {
    it("changes state accordingly", () => createRootAndBind(async () => {
      const currentTrainTripResult = await root.request(getTrainTrip, { trainTripId })

      const result = await root.request(lockTrainTrip, { trainTripId })

      const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })
      expect(result).toBeInstanceOf(Ok)
      // We don't want to leak accidentally domain objects
      expect(result._unsafeUnwrap()).toBe(void 0)
      expect(currentTrainTripResult).toBeInstanceOf(Ok)
      expect(currentTrainTripResult._unsafeUnwrap().allowUserModification).toBe(true)
      expect(newTrainTripResult._unsafeUnwrap().allowUserModification).toBe(false)
      expect(executePostCommitHandlersMock).toBeCalledTimes(1)
    }))
  })

  describe("able to delete the TrainTrip", () => {
    it("deletes accordingly", () => createRootAndBind(async () => {
      const currentTrainTripResult = await root.request(getTrainTrip, { trainTripId })

      const result = await root.request(deleteTrainTrip, { trainTripId })

      const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })
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

  describe("register Cloud", () => {
    it("works", () => createRootAndBind(async () => {
      const result = await root.request(registerCloud, { trainTripId })

      expect(result).toBeInstanceOf(Ok)
      expect(result._unsafeUnwrap()).toBe(void 0)
      expect(executePostCommitHandlersMock).toBeCalledTimes(0)
    }))
  })
})

describe("integration events", () => {
  describe("CustomerRequestedChanges", () => {
    it("locks the TrainTrip", () => createRootAndBind(async () => {
      await root.publishInNewContext(
        JSON.stringify({
          payload: { trainTripId, itineraryId: "some-itinerary-id" },
          type: "CustomerRequestedChanges",
        } as CustomerRequestedChangesDTO),
        generateShortUuid(),
      )

      const newTrainTripResult = await root.request(getTrainTrip, { trainTripId })
      expect(newTrainTripResult._unsafeUnwrap().allowUserModification).toBe(false)
    }))
  })
})
