import { createEventHandlerWithDeps, DbError, flatMap, map, pipe, PipeFunction } from "@fp-app/framework"
import { trainTripReadContextKey } from "../infrastructure/TrainTripReadContext.disk"
import TrainTrip, { TrainTripCreated, TrainTripDeleted, TrainTripStateChanged } from "../TrainTrip"
import { TrainTripView } from "../usecases/getTrainTrip"
import { DbContextKey, defaultDependencies } from "../usecases/types"

const updateTrainTripView = ({ db, readCtx }: { db: typeof DbContextKey, readCtx: typeof trainTripReadContextKey })
  : PipeFunction<TrainTripCreated | TrainTripStateChanged, void, DbError> =>
  pipe(
    map(({ id }) => id),
    flatMap(db.trainTrips.load),
    map(TrainTripToView),
    map(view => readCtx.create(view.id, view)),
  )

const createEventHandler = createEventHandlerWithDeps({ db: DbContextKey, readCtx: trainTripReadContextKey, ...defaultDependencies })
createEventHandler<TrainTripCreated, void, DbError>(
  /* on */ TrainTripCreated, "UpdateView",
  updateTrainTripView,
)

createEventHandler<TrainTripStateChanged, void, DbError>(
  /* on */ TrainTripStateChanged, "UpdateView",
  updateTrainTripView,
)

createEventHandler<TrainTripDeleted, void, DbError>(
  /* on */ TrainTripDeleted, "DeleteView",
  ({ readCtx }) => pipe(
    map(({ id }) => id),
    map(readCtx.delete),
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
