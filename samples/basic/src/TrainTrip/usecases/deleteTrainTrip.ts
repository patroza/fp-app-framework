import { DbError } from "@fp-app/framework"
import { createCommandWithDeps } from "@fp-app/framework"
import { flatMap, map, pipe } from "@fp-app/neverthrow-extensions"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const deleteTrainTrip = createCommand<Input, void, DeleteTrainTripError>("deleteTrainTrip",
  ({ db }) => pipe(
    map(({ trainTripId }) => trainTripId),
    flatMap(db.trainTrips.load),
    map(db.trainTrips.remove),
  ))

export default deleteTrainTrip
export interface Input { trainTripId: string }
type DeleteTrainTripError = DbError
