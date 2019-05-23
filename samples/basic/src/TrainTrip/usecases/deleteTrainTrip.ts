import { DbError } from "@fp-app/framework"
import { createCommandWithDeps } from "@fp-app/framework"
import { flatMap, map, pipe } from "@fp-app/neverthrow-extensions"
import trainTripReadContext from "../infrastructure/TrainTripReadContext.disk"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const deleteTrainTrip = createCommand<Input, void, DeleteTrainTripError>("deleteTrainTrip",
  ({ db }) => pipe(
    map(({ trainTripId }) => trainTripId),
    flatMap(db.trainTrips.load),
    map(trip => { db.trainTrips.remove(trip); return trip }),

    // TODO: This should be based on event "TrainTripDeleted"
    // and we should use something else than RecordContext
    map(trip => trainTripReadContext.delete(trip.id)),
  ))

export default deleteTrainTrip
export interface Input { trainTripId: string }
type DeleteTrainTripError = DbError
