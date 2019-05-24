import { StateProposition as ValidatedStateProposition } from "@/TrainTrip/TrainTrip"
import { combineValidationErrors, toFieldError, ValidationError } from "@fp-app/framework"
import { DbError } from "@fp-app/framework"
import { createCommandWithDeps } from "@fp-app/framework"
import {
  flatMap, map, mapErr, ok, pipe, PipeFunction, resultTuple, toFlatTup, toTup, valueOrUndefined,
} from "@fp-app/neverthrow-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TravelClassDefinition from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const changeTrainTrip = createCommand<Input, void, ChangeTrainTripError>("changeTrainTrip",
  ({ db }) => pipe(
    flatMap(toTup(validateStateProposition)),
    flatMap(toFlatTup(([, i]) => db.trainTrips.load(i.trainTripId))),
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

const validateStateProposition: PipeFunction<StateProposition, ValidatedStateProposition, ValidationError> =
  pipe(
    flatMap(({ travelClass, pax, startDate, ...rest }) =>
      resultTuple(
        valueOrUndefined(travelClass, TravelClassDefinition.create).pipe(mapErr(toFieldError("travelClass"))),
        valueOrUndefined(startDate, FutureDate.create).pipe(mapErr(toFieldError("startDate"))),
        valueOrUndefined(pax, PaxDefinition.create).pipe(mapErr(toFieldError("pax"))),
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
