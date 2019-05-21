import { DbError } from 'fp-app-framework/infrastructure/errors'
import { createCommandWithDeps } from 'fp-app-framework/infrastructure/mediator'
import { flatMap, map, pipe } from 'fp-app-framework/utils/neverthrow-extensions'
import { DbContextKey, defaultDependencies } from './types'

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const lockTrainTrip = createCommand<Input, void, LockTrainTripError>('lockTrainTrip',
  ({ db }) => pipe(
    flatMap(({ trainTripId }) => db.trainTrips.load(trainTripId)),
    map(trainTrip => trainTrip.lock()),
  ))

export default lockTrainTrip
export interface Input { trainTripId: string }
type LockTrainTripError = DbError
