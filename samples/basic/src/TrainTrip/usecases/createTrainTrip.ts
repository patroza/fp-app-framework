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
import {
  err,
  flatMap,
  map,
  mapErr,
  ok,
  pipe,
  PipeFunction,
  Result,
  resultTuple,
  tee,
  toTup,
  compose,
} from "@fp-app/fp-ts-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import TrainTrip, { CreateTrainTripInfo } from "../TrainTrip"
import { DbContextKey, defaultDependencies, getTripKey } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, getTrip: getTripKey, ...defaultDependencies })

const createTrainTrip = createCommand<Input, string, CreateError>("createTrainTrip", ({ db, getTrip }) =>
  pipe(
    flatMap(validateCreateTrainTripInfo),
    flatMap(toTup(({ templateId }) => getTrip(templateId))),
    map(([trip, proposal]) => TrainTrip.create(proposal, trip)),
    map(tee(db.trainTrips.add)),
    map(trainTrip => trainTrip.id),
  ),
)

export default createTrainTrip
export interface Input {
  templateId: string
  pax: Pax
  startDate: string
}

// the problem is that the fp-ts pipe doesnt return a data last function, but data first ;-)

const validateCreateTrainTripInfo: PipeFunction<Input, CreateTrainTripInfo, ValidationError> = pipe(
  flatMap(({ pax, startDate, templateId }) =>
    compose(
      resultTuple(
        compose(
          PaxDefinition.create(pax),
          mapErr(toFieldError("pax")),
        ),
        compose(
          FutureDate.create(startDate),
          mapErr(toFieldError("startDate")),
        ),
        compose(
          validateString(templateId),
          mapErr(toFieldError("templateId")),
        ),
      ),
      mapErr(combineValidationErrors),

      map(([pax, startDate, templateId]) => ({
        pax,
        startDate,
        templateId,
      })),
    ),
  ),

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
