//// Separate endpoint sample; unused.

import { createCommandWithDeps, ForbiddenError, InvalidStateError, ValidationError, DbError } from "@fp-app/framework"
import { TE, compose, TEtoTup, TEtoFlatTup, liftType } from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import TravelClassDefinition, { TravelClassName } from "../TravelClassDefinition"
import { DbContextKey, defaultDependencies } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, ...defaultDependencies })

export const changeStartDate = createCommand<ChangeStartDateInput, void, ChangeStartDateError>(
  "changeStartDate",
  ({ db }) => (input: ChangeStartDateInput) =>
    compose(
      TE.right<ChangeStartDateError, ChangeStartDateInput>(input),
      TE.chain(
        TEtoTup(({ startDate }) =>
          compose(
            TE.fromEither(FutureDate.create(startDate)),
            TE.mapLeft(liftType<ChangeStartDateError>()),
          ),
        ),
      ),
      TE.chain(
        TEtoFlatTup(([, i]) =>
          compose(
            db.trainTrips.load(i.trainTripId),
            TE.mapLeft(liftType<ChangeStartDateError>()),
          ),
        ),
      ),
      TE.chain(([trainTrip, sd]) =>
        compose(
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

export const changeTravelClass = createCommand<ChangeTravelClassInput, void, ChangeTravelClassError>(
  "changeTravelClass",
  ({ db }) => (input: ChangeTravelClassInput) =>
    compose(
      TE.right<ChangeTravelClassError, ChangeTravelClassInput>(input),
      TE.chain(
        TEtoTup(({ travelClass }) =>
          compose(
            TE.fromEither(TravelClassDefinition.create(travelClass)),
            TE.mapLeft(liftType<ChangeTravelClassError>()),
          ),
        ),
      ),
      TE.chain(
        TEtoFlatTup(([, i]) =>
          compose(
            db.trainTrips.load(i.trainTripId),
            TE.mapLeft(liftType<ChangeTravelClassError>()),
          ),
        ),
      ),
      TE.chain(([trainTrip, sl]) =>
        compose(
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
type ChangeTravelClassError = ForbiddenError | InvalidStateError | ValidationError | DbError
