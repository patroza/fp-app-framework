import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { compose, TE } from "@fp-app/fp-ts-extensions"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const lockTrainTrip = createCommand<Input, void, LockTrainTripError>("lockTrainTrip", ({ db }) => (input: Input) =>
  compose(
    TE.right(input),
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
