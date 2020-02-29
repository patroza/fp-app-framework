// TODO: we have to find out a way on how we can prevent serializing domain objects to the outside world by accident
// One way could that it's somehow whitelisted (ie no behavior allowed)
// or that a serializer must be presented at all times, if no serializer, then automatically void..
// the alternative is making sure there are return types defined in Typescript, and e.g validated with Tests.
// to make sure accidental `any` casts are catched.

import { createQueryWithDeps, DbError } from "@fp-app/framework"
import { TE, compose } from "@fp-app/fp-ts-extensions"
import { trainTripReadContextKey } from "../infrastructure/TrainTripReadContext.disk"
import { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import { defaultDependencies } from "./types"

const createQuery = createQueryWithDeps({
  readCtx: trainTripReadContextKey,
  ...defaultDependencies,
})

const getTrainTrip = createQuery<Input, TrainTripView, DbError>(
  "getTrainTrip",
  ({ readCtx }) =>
    compose(
      TE.map(({ trainTripId }) => trainTripId),
      TE.chain(readCtx.read),
    ),
)

export default getTrainTrip
export interface Input {
  trainTripId: string
}

export interface TrainTripView {
  id: string
  createdAt: Date

  allowUserModification: boolean

  pax: Pax
  travelClass: TravelClassName
  travelClasses: { templateId: string; name: TravelClassName }[]
  startDate: Date
}
