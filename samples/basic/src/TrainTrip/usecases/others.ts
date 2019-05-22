//// Separate endpoint sample; unused.

import { ValidationError } from '@fp-app/framework'
import { RecordNotFound } from '@fp-app/framework'
import { createCommandWithDeps } from '@fp-app/framework'
import { flatMap, pipe, toFlatTup, toTup } from '@fp-app/neverthrow-extensions'
import FutureDate from '../FutureDate'
import TravelClassDefinition, { TravelClassName } from '../TravelClassDefinition'
import { DbContextKey, defaultDependencies } from './types'

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

export const changeStartDate = createCommand<ChangeStartDateInput, void, ChangeStartDateError>('changeStartDate',
  ({ db }) => pipe(
    flatMap(toTup(({ startDate }) => FutureDate.create(startDate))),
    flatMap(toFlatTup(([, i]) => db.trainTrips.load(i.trainTripId))),
    flatMap(([trainTrip, sd]) => trainTrip.changeStartDate(sd)),
  ),
)

export interface ChangeStartDateInput { trainTripId: string, startDate: string }
type ChangeStartDateError = ValidationError | RecordNotFound

export const changeTravelClass = createCommand<ChangeTravelClassInput, void, ChangeTravelClassError>('changeTravelClass',
  ({ db }) => pipe(
    flatMap(toTup(({ travelClass }) => TravelClassDefinition.create(travelClass))),
    flatMap(toFlatTup(([, i]) => db.trainTrips.load(i.trainTripId))),
    flatMap(([trainTrip, sl]) => trainTrip.changeTravelClass(sl)),
  ),
)

export interface ChangeTravelClassInput { trainTripId: string, travelClass: TravelClassName }
type ChangeTravelClassError = ValidationError | RecordNotFound
