import { createEventHandlerWithDeps, DbError, flatMap, map, pipe } from "@fp-app/framework"
import trainTripReadContext from "../infrastructure/TrainTripReadContext.disk"
import TrainTrip, { TrainTripCreated, TrainTripStateChanged } from "../TrainTrip"
import { TrainTripView } from "../usecases/getTrainTrip"
import { DbContextKey, defaultDependencies } from "../usecases/types"

const createEventHandler = createEventHandlerWithDeps({ db: DbContextKey, ...defaultDependencies })

createEventHandler<TrainTripCreated, void, DbError>(
  /* on */ TrainTripCreated, "UpdateView",
  ({ db }) => pipe(
    flatMap(({ id }) => db.trainTrips.load(id)),
    map(TrainTripToView),
    map(view => trainTripReadContext.create(view.id, view)),
  ),
)

createEventHandler<TrainTripStateChanged, void, DbError>(
  /* on */ TrainTripStateChanged, "UpdateView",
  ({ db }) => pipe(
    flatMap(({ id }) => db.trainTrips.load(id)),
    map(TrainTripToView),
    map(view => trainTripReadContext.create(view.id, view)),
  ),
)

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
