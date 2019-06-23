import { StateProposition as ValidatedStateProposition } from "@/TrainTrip/TrainTrip"
import {
  combineValidationErrors,
  createCommandWithDeps,
  DbError,
  ForbiddenError,
  InvalidStateError,
  toFieldError,
  ValidationError,
} from "@fp-app/framework"
import {
  flatMap,
  map,
  mapErr,
  ok,
  pipe,
  PipeFunction,
  resultTuple,
  toFlatTup,
  toTup,
  valueOrUndefined,
  compose,
} from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TravelClassDefinition from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const changeTrainTrip = createCommand<Input, void, ChangeTrainTripError>("changeTrainTrip", ({ db }) =>
  pipe(
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

const validateStateProposition: PipeFunction<StateProposition, ValidatedStateProposition, ValidationError> = pipe(
  flatMap(({ travelClass, pax, startDate, ...rest }) =>
    compose(
      resultTuple(
        compose(
          valueOrUndefined(travelClass, TravelClassDefinition.create),
          mapErr(toFieldError("travelClass")),
        ),
        compose(
          valueOrUndefined(startDate, FutureDate.create),
          mapErr(toFieldError("startDate")),
        ),
        compose(
          valueOrUndefined(pax, PaxDefinition.create),
          mapErr(toFieldError("pax")),
        ),
        ok(rest),
      ),
      mapErr(combineValidationErrors),
      map(([travelClass, startDate, pax, rest]) => ({
        ...rest,
        pax,
        startDate,
        travelClass,
      })),
    ),
  ),
)

type ChangeTrainTripError = ForbiddenError | InvalidStateError | ValidationError | DbError
