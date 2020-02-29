//// Separate endpoint sample; unused.

import {
  createCommandWithDeps,
  ForbiddenError,
  InvalidStateError,
  ValidationError,
  DbError,
} from "@fp-app/framework"
import {
  TE,
  pipe,
  chainTupTask,
  chainFlatTupTask,
  liftType,
  compose,
} from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import TravelClassDefinition, { TravelClassName } from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({
  db: DbContextKey,
  ...defaultDependencies,
})

export const changeStartDate = createCommand<
  ChangeStartDateInput,
  void,
  ChangeStartDateError
>("changeStartDate", ({ db }) =>
  compose(
    chainTupTask(({ startDate }) =>
      pipe(
        TE.fromEither(FutureDate.create(startDate)),
        TE.mapLeft(liftType<ChangeStartDateError>()),
      ),
    ),
    chainFlatTupTask(([, i]) =>
      pipe(
        db.trainTrips.load(i.trainTripId),
        TE.mapLeft(liftType<ChangeStartDateError>()),
      ),
    ),
    TE.chain(([trainTrip, sd]) =>
      pipe(
        TE.fromEither(trainTrip.changeStartDate(sd)),
        TE.mapLeft(liftType<ChangeStartDateError>()),
      ),
    ),
  ),
)

export interface ChangeStartDateInput {
  trainTripId: string
  startDate: string
}
type ChangeStartDateError = ValidationError | ForbiddenError | DbError

export const changeTravelClass = createCommand<
  ChangeTravelClassInput,
  void,
  ChangeTravelClassError
>("changeTravelClass", ({ db }) =>
  compose(
    chainTupTask(({ travelClass }) =>
      pipe(
        TE.fromEither(TravelClassDefinition.create(travelClass)),
        TE.mapLeft(liftType<ChangeTravelClassError>()),
      ),
    ),
    chainFlatTupTask(([, i]) =>
      pipe(
        db.trainTrips.load(i.trainTripId),
        TE.mapLeft(liftType<ChangeTravelClassError>()),
      ),
    ),
    TE.chain(([trainTrip, sl]) =>
      pipe(
        TE.fromEither(trainTrip.changeTravelClass(sl)),
        TE.mapLeft(liftType<ChangeTravelClassError>()),
      ),
    ),
  ),
)
export interface ChangeTravelClassInput {
  trainTripId: string
  travelClass: TravelClassName
}
type ChangeTravelClassError =
  | ForbiddenError
  | InvalidStateError
  | ValidationError
  | DbError
