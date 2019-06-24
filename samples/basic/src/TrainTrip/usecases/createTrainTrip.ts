import {
  ApiError,
  CombinedValidationError,
  combineValidationErrors,
  createCommandWithDeps,
  InvalidStateError,
  toFieldError,
  ValidationError,
} from "@fp-app/framework"
import { err, ok, Result, resultTuple, tee, compose, E, TE, liftType, TEtoTup } from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TrainTrip from "../TrainTrip"
import { DbContextKey, defaultDependencies, getTripKey } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, getTrip: getTripKey, ...defaultDependencies })

const createTrainTrip = createCommand<Input, string, CreateError>("createTrainTrip", ({ db, getTrip }) =>
  //  pipe(
  (input: Input) =>
    compose(
      TE.right<CreateError, Input>(input),
      TE.chain(i =>
        compose(
          TE.fromEither(validateCreateTrainTripInfo(i)),
          TE.mapLeft(liftType<CreateError>()),
        ),
      ),
      TE.chain(
        TEtoTup(i =>
          compose(
            getTrip(i.templateId),
            TE.mapLeft(liftType<CreateError>()),
          ),
        ),
      ),
      TE.chain(([trip, proposal]) =>
        TE.fromEither(
          compose(
            E.right<CreateError, TrainTrip>(TrainTrip.create(proposal, trip)),
            E.map(tee(db.trainTrips.add)),
            E.map(trainTrip => trainTrip.id),
          ),
        ),
      ),
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

type CreateError = CombinedValidationError | InvalidStateError | ValidationError | ApiError
