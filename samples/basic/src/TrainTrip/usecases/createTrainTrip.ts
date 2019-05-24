import { CombinedValidationError, combineValidationErrors, toFieldError, ValidationError } from "@fp-app/framework"
import { ApiError, DbError } from "@fp-app/framework"
import { createCommandWithDeps } from "@fp-app/framework"
import { err, flatMap, map, mapErr, ok, pipe, PipeFunction, Result, resultTuple, tee, toTup } from "@fp-app/neverthrow-extensions"
import FutureDate from "../FutureDate"
import PaxDefinition, { Pax } from "../PaxDefinition"
import { CreateTrainTripInfo } from "../TrainTrip"
import { DbContextKey, defaultDependencies, getTripKey } from "./types"

const createCommand = createCommandWithDeps({ db: DbContextKey, getTrip: getTripKey, ...defaultDependencies })

const createTrainTrip = createCommand<Input, string, CreateError>("createTrainTrip",
  ({ db, getTrip }) => pipe(
    flatMap(validateCreateTrainTripInfo),
    flatMap(toTup(({ templateId }) => getTrip(templateId))),
    map(([trip, proposal]) => trip.createTrainTrip(proposal)),
    map(tee(db.trainTrips.add)),
    map(trainTrip => trainTrip.id),
  ),
)

export default createTrainTrip
export interface Input { templateId: string, pax: Pax, startDate: string }

const validateCreateTrainTripInfo: PipeFunction<Input, CreateTrainTripInfo, ValidationError> =
  pipe(
    flatMap(({ pax, startDate, templateId }) =>
      resultTuple(
        PaxDefinition.create(pax).pipe(mapErr(toFieldError("pax"))),
        FutureDate.create(startDate).pipe(mapErr(toFieldError("startDate"))),
        validateString(templateId).pipe(mapErr(toFieldError("templateId"))),
      ).pipe(mapErr(combineValidationErrors)),
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

    map(([pax, startDate, templateId]) => ({
      pax, startDate, templateId,
    })),
  )

// TODO
const validateString = <T extends string>(str: string): Result<T, ValidationError> =>
  str ? ok(str as T) : err(new ValidationError("not a valid str"))

type CreateError = CombinedValidationError | ValidationError | ApiError | DbError
