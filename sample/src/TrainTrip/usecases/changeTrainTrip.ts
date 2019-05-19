import { StateProposition as ValidatedStateProposition } from '@/TrainTrip/TrainTrip'
import { combineValidationErrors, toFieldError, ValidationError } from 'fp-app-framework/errors'
import { DbError } from 'fp-app-framework/infrastructure/errors'
import { createCommandWithDeps } from 'fp-app-framework/infrastructure/requestHandlers'
import {
  flatMap, map, mapErr, pipe, PipeFunction, resultTuple, toFlatTup, toTup, valueOrUndefined,
} from 'fp-app-framework/utils/neverthrow-extensions'
import { ok } from 'neverthrow'
import FutureDate from '../FutureDate'
import PaxDefinition, { Pax } from '../PaxDefinition'
import TravelClassDefinition from '../TravelClassDefinition'
import { DbContextKey, defaultDependencies } from './types'

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const changeTrainTrip = createCommand<Input, void, ChangeTrainTripError>('changeTrainTrip',
  ({ db }) => pipe(
    flatMap(toTup(validateInput)),
    flatMap(toFlatTup(([_, i]) => db.trainTrips.load(i.trainTripId))),
    flatMap(([trainTrip, proposal]) => trainTrip.proposeChanges(proposal)),
  ),
)

export default changeTrainTrip

export interface Input extends StateProposition {
  trainTripId: string
}

export interface StateProposition {
  pax?: Pax
  startDate?: string
  travelClass?: string
}

const validateInput: PipeFunction<StateProposition, ValidatedStateProposition, ValidationError> =
  pipe(
    flatMap(({ travelClass, pax, startDate, ...rest }) =>
      resultTuple(
        valueOrUndefined(travelClass, TravelClassDefinition.create).pipe(mapErr(toFieldError('travelClass'))),
        valueOrUndefined(startDate, FutureDate.create).pipe(mapErr(toFieldError('startDate'))),
        valueOrUndefined(pax, PaxDefinition.create).pipe(mapErr(toFieldError('pax'))),
        ok(rest),
      ).pipe(mapErr(combineValidationErrors)),
    ),
    map(([travelClass, startDate, pax, rest]) => ({
      ...rest,
      pax,
      startDate,
      travelClass,
    })),
  )

type ChangeTrainTripError = ValidationError | DbError
