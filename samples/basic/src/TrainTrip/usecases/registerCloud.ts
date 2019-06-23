import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { flatMap, map, pipe, toTup, compose } from "@fp-app/fp-ts-extensions"
import { DbContextKey, defaultDependencies, sendCloudSyncKey } from "./types"

const createCommand = createCommandWithDeps({
  db: DbContextKey,
  sendCloudSync: sendCloudSyncKey,
  ...defaultDependencies,
})

const registerCloud = createCommand<Input, void, DbError>("registerCloud", ({ db, sendCloudSync }) =>
  pipe(
    map(({ trainTripId }) => trainTripId),
    flatMap(db.trainTrips.load),
    flatMap(trainTrip =>
      compose(
        sendCloudSync(trainTrip),
        map(opportunityId => trainTrip.assignOpportunity(opportunityId)),
      ),
    ),
  ),
)

export default registerCloud
export interface Input {
  trainTripId: string
}
