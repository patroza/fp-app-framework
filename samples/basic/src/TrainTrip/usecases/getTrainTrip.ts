// TODO: we have to find out a way on how we can prevent serializing domain objects to the outside world by accident
// One way could that it's somehow whitelisted (ie no behavior allowed)
// or that a serializer must be presented at all times, if no serializer, then automatically void..
// the alternative is making sure there are return types defined in Typescript, and e.g validated with Tests.
// to make sure accidental `any` casts are catched.

import TrainTrip from "@/TrainTrip/TrainTrip"
import { DbError } from "@fp-app/framework"
import { createQueryWithDeps } from "@fp-app/framework"
import { flatMap, map, pipe } from "@fp-app/neverthrow-extensions"
import { Pax } from "../PaxDefinition"
import { TravelClassName } from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createQuery = createQueryWithDeps({ db: DbContextKey, ...defaultDependencies })

const getTrainTrip = createQuery<Input, TrainTripView, DbError>("getTrainTrip",
  ({ db }) => pipe(
    map(({ trainTripId }) => trainTripId),
    flatMap(db.trainTrips.load),
    map(TrainTripToView),
  ),
)

export default getTrainTrip
export interface Input { trainTripId: string }

export interface TrainTripView {
  id: string
  createdAt: Date

  allowUserModification: boolean

  pax: Pax
  travelClass: TravelClassName
  travelClasss: Array<{ templateId: string, name: TravelClassName }>
  startDate: Date
}

const TrainTripToView = ({
  isLocked, createdAt, id, pax, currentTravelClassConfiguration, startDate, trip,
}: TrainTrip): TrainTripView => {
  return {
    id,

    allowUserModification: !isLocked,
    createdAt,

    pax: pax.value,
    startDate,
    travelClass: currentTravelClassConfiguration.travelClass.name,
    travelClasss: trip.travelClasss.map(({ templateId, name }) => ({ templateId, name })),
  }
}
