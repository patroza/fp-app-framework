import { createCommandWithDeps, DbError } from "@fp-app/framework"
import { flatMap, map, pipe, toTup } from "@fp-app/neverthrow-extensions"
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
    flatMap(toTup(sendCloudSync)),
    map(([opportunityId, trainTrip]) => trainTrip.assignOpportunity(opportunityId)),
  ),
)

export default registerCloud
export interface Input {
  trainTripId: string
}
