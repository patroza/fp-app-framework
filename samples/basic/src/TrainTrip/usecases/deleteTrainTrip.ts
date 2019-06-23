import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { flatMap, map, pipe, tee } from "@fp-app/fp-ts-extensions"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const deleteTrainTrip = createCommand<Input, void, DeleteTrainTripError>("deleteTrainTrip", ({ db }) =>
  pipe(
    map(({ trainTripId }) => trainTripId),
    flatMap(db.trainTrips.load),
    map(x => {
      // TODO: this should normally be on a different object.
      x.delete()
      return db.trainTrips.remove(x)
    }),
  ),
)

export default deleteTrainTrip
export interface Input {
  trainTripId: string
}
type DeleteTrainTripError = DbError
