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
  ok,
  resultTuple,
  valueOrUndefined,
  compose,
  TEtoTup,
  E,
  TEtoFlatTup,
  TE,
  liftType,
  pipe,
} from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TravelClassDefinition from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

const changeTrainTrip = createCommand<Input, void, ChangeTrainTripError>("changeTrainTrip", ({ db }) =>
  pipe(
    TE.chain(
      TEtoTup(i =>
        compose(
          TE.fromEither(validateStateProposition(i)),
          TE.mapLeft(liftType<ChangeTrainTripError>()),
        ),
      ),
    ),
    TE.chain(
      TEtoFlatTup(([, i]) =>
        compose(
          db.trainTrips.load(i.trainTripId),
          TE.mapLeft(liftType<ChangeTrainTripError>()),
        ),
      ),
    ),
    TE.chain(([trainTrip, proposal]) =>
      compose(
        TE.fromEither(trainTrip.proposeChanges(proposal)),
        TE.mapLeft(liftType<ChangeTrainTripError>()),
      ),
    ),
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

const validateStateProposition = ({ travelClass, pax, startDate, ...rest }: StateProposition) =>
  compose(
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
    E.mapLeft(combineValidationErrors),
    E.map(([travelClass, startDate, pax, rest]) => ({
      ...rest,
      pax,
      startDate,
      travelClass,
    })),
  )

type ChangeTrainTripError = ForbiddenError | InvalidStateError | ValidationError | DbError
