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
  TEtoTup,
  E,
  TEtoFlatTup,
} from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TravelClassDefinition from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const changeTrainTrip = createCommand<Input, void, ChangeTrainTripError>("changeTrainTrip", ({ db }) =>
  pipe(
    //flatMap(toTup(validateStateProposition)),
    flatMap(TEtoTup(validateStateProposition)),
    flatMap(TEtoFlatTup(([, i]) => db.trainTrips.load(i.trainTripId))),
    flatMap(([trainTrip, proposal]) => async () => trainTrip.proposeChanges(proposal)),
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

const validateStateProposition: PipeFunction<StateProposition, ValidatedStateProposition, ValidationError> = ({
  travelClass,
  pax,
  startDate,
  ...rest
}) =>
  compose(
    async () =>
      resultTuple(
        compose(
          valueOrUndefined(travelClass, TravelClassDefinition.create),
          E.mapLeft(toFieldError("travelClass")),
        ),
        compose(
          valueOrUndefined(startDate, FutureDate.create),
          E.mapLeft(toFieldError("startDate")),
        ),
        compose(
          valueOrUndefined(pax, PaxDefinition.create),
          E.mapLeft(toFieldError("pax")),
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
  )

type ChangeTrainTripError = ForbiddenError | InvalidStateError | ValidationError | DbError
