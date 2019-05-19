import { DbError } from 'fp-app-framework/infrastructure/errors'
import { createCommandWithDeps } from 'fp-app-framework/infrastructure/requestHandlers'
import { flatMap, map, pipe, toTup } from 'fp-app-framework/utils/neverthrow-extensions'
import { DbContextKey, defaultDependencies, sendCloudSyncKey } from './types'

const createCommand = createCommandWithDeps({ db: DbContextKey, sendCloudSync: sendCloudSyncKey, ...defaultDependencies })

const registerCloud = createCommand<Input, void, DbError>('registerCloud',
  ({ db, sendCloudSync }) => pipe(
    flatMap(({ trainTripId }) => db.trainTrips.load(trainTripId)),
    flatMap(toTup(sendCloudSync)),
    map(([opportunityId, trainTrip]) => trainTrip.assignOpportunity(opportunityId)),
  ),
)

export default registerCloud
export interface Input { trainTripId: string }