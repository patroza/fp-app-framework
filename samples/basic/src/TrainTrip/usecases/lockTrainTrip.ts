import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { flatMap, map, pipe } from "@fp-app/neverthrow-extensions"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const lockTrainTrip = createCommand<Input, void, LockTrainTripError>("lockTrainTrip",
  ({ db }) => pipe(
    map(({ trainTripId }) => trainTripId),
    flatMap(db.trainTrips.load),
    map(trainTrip => trainTrip.lock()),
  ))

export default lockTrainTrip
export interface Input { trainTripId: string }
type LockTrainTripError = DbError
