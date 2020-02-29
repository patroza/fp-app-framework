import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { TE, compose } from "@fp-app/fp-ts-extensions"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({
  db: DbContextKey,
  ...defaultDependencies,
})

const lockTrainTrip = createCommand<Input, void, LockTrainTripError>(
  "lockTrainTrip",
  ({ db }) =>
    compose(
      TE.map(({ trainTripId }) => trainTripId),
      TE.chain(db.trainTrips.load),
      TE.map(trainTrip => trainTrip.lock()),
    ),
)

export default lockTrainTrip
export interface Input {
  trainTripId: string
}
type LockTrainTripError = DbError
