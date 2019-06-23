import {
  ApiError,
  CombinedValidationError,
  combineValidationErrors,
  createCommandWithDeps,
  DbError,
  InvalidStateError,
  toFieldError,
  ValidationError,
} from "@fp-app/framework"
import { err, ok, Result, resultTuple, tee, compose, E, TE } from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TrainTrip from "../TrainTrip"
import { DbContextKey, defaultDependencies, getTripKey } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, getTrip: getTripKey, ...defaultDependencies })

const createTrainTrip = createCommand<Input, string, CreateError>("createTrainTrip", ({ db, getTrip }) =>
  //  pipe(
  (input: Input) =>
    compose(
      TE.right(input),
      TE.chain(i => TE.fromEither(validateCreateTrainTripInfo(i))),
      TE.chain(proposal =>
        // TODO: Tuple instead of going in
        compose(
          getTrip(proposal.templateId),
          TE.map(trip => TrainTrip.create(proposal, trip)),
          TE.map(tee(db.trainTrips.add)),
          TE.map(trainTrip => trainTrip.id),
        ),
      ),
      // TODO tup
    ),
)

export default createTrainTrip
export interface Input {
  templateId: string
  pax: Pax
  startDate: string
}

// the problem is that the fp-ts pipe doesnt return a data last function, but data first ;-)

const validateCreateTrainTripInfo = ({ pax, startDate, templateId }: Input) =>
  compose(
    resultTuple(
      compose(
        PaxDefinition.create(pax),
        E.mapLeft(toFieldError("pax")),
      ),
      compose(
        FutureDate.create(startDate),
        E.mapLeft(toFieldError("startDate")),
      ),
      compose(
        validateString(templateId),
        E.mapLeft(toFieldError("templateId")),
      ),
    ),
    E.mapLeft(combineValidationErrors),

    E.map(([pax, startDate, templateId]) => ({
      pax,
      startDate,
      templateId,
    })),

    // Alt 1
    // flatMap(input =>
    //   resultTuple3(
    //     input,
    //     ({ pax }) => PaxDefinition.create(pax).pipe(mapErr(toFieldError('pax'))),
    //     ({ startDate }) => FutureDate.create(startDate).pipe(mapErr(toFieldError('startDate'))),
    //     ({ templateId }) => validateString(templateId).pipe(mapErr(toFieldError('templateId'))),
    //   ).mapErr(combineValidationErrors),
    // ),

    // Alt 2
    // Why doesn't this work?
    // flatMap(resultTuple2(
    //   ({pax}) => PaxDefinition.create(pax).pipe(mapErr(toFieldError('pax'))),
    //   ({startDate}) => FutureDate.create(startDate).pipe(mapErr(toFieldError('startDate'))),
    //   ({templateId}) => validateString(templateId).pipe(mapErr(toFieldError('templateId'))),
    // )),
    // mapErr(combineValidationErrors),
  )

// TODO
const validateString = <T extends string>(str: string): Result<T, ValidationError> =>
  str ? ok(str as T) : err(new ValidationError("not a valid str"))

type CreateError = CombinedValidationError | InvalidStateError | ValidationError | ApiError | DbError
