import { createEventHandlerWithDeps, DbError, flatMap, map, pipe } from "@fp-app/framework"
import trainTripReadContext from "../infrastructure/TrainTripReadContext.disk"
import TrainTrip, { TrainTripCreated, TrainTripDeleted, TrainTripStateChanged } from "../TrainTrip"
import { TrainTripView } from "../usecases/getTrainTrip"
import { DbContextKey, defaultDependencies } from "../usecases/types"

const createEventHandler = createEventHandlerWithDeps({ db: DbContextKey, ...defaultDependencies })

createEventHandler<TrainTripCreated, void, DbError>(
  /* on */ TrainTripCreated, "UpdateView",
  ({ db }) => pipe(
    map(({ id }) => id),
    flatMap(db.trainTrips.load),
    map(TrainTripToView),
    map(view => trainTripReadContext.create(view.id, view)),
  ),
)

createEventHandler<TrainTripStateChanged, void, DbError>(
  /* on */ TrainTripStateChanged, "UpdateView",
  ({ db }) => pipe(
    map(({ id }) => id),
    flatMap(db.trainTrips.load),
    map(TrainTripToView),
    map(view => trainTripReadContext.create(view.id, view)),
  ),
)

createEventHandler<TrainTripDeleted, void, DbError>(
  /* on */ TrainTripDeleted, "DeleteView",
  () => pipe(
    map(({ id }) => id),
    map(id => trainTripReadContext.delete(id)),
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
