import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { compose, TE, liftType } from "@fp-app/fp-ts-extensions"
import { DbContextKey, defaultDependencies, sendCloudSyncKey } from "./types"

const createCommand = createCommandWithDeps({
  db: DbContextKey,
  sendCloudSync: sendCloudSyncKey,
  ...defaultDependencies,
})

const registerCloud = createCommand<Input, void, DbError>("registerCloud", ({ db, sendCloudSync }) => (input: Input) =>
  compose(
    TE.right(input),
    TE.map(({ trainTripId }) => trainTripId),
    TE.chain(db.trainTrips.load),
    TE.chain(trainTrip =>
      compose(
        sendCloudSync(trainTrip), // tup
        TE.map(opportunityId => trainTrip.assignOpportunity(opportunityId)),
        TE.mapLeft(liftType<DbError>()),
      ),
    ),
  ),
)

export default registerCloud
export interface Input {
  trainTripId: string
}
