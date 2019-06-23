import {
  flatMap,
  flatTee,
  liftType,
  mapErr,
  Result,
  taskEither,
  compose,
  AsyncResult,
  TE,
} from "@fp-app/fp-ts-extensions"
import { benchLog, logger, using } from "../../utils"
import { DbError } from "../errors"
import { configureDependencies, NamedRequestHandler, UOWKey } from "../mediator"
import { requestTypeSymbol } from "../SimpleContainer"
import { mapLeft } from "fp-ts/lib/IOEither"

const loggingDecorator = (): RequestDecorator => request => (key, input) => {
  const prefix = `${key.name} ${key[requestTypeSymbol]}`
  return benchLog(
    () =>
      using(logger.addToLoggingContext({ request: prefix }), async () => {
        logger.log(`${prefix} input`, input)
        const result = await request(key, input)
        logger.log(`${prefix} result`, result)
        return result
      }),
    prefix,
  )
}

const uowDecorator = configureDependencies(
  { unitOfWork: UOWKey },
  "uowDecorator",
  ({ unitOfWork }): RequestDecorator => request => (key, input) => {
    if (key[requestTypeSymbol] !== "COMMAND" && key[requestTypeSymbol] !== "INTEGRATIONEVENT") {
      return request(key, input)
    }

    return compose(
      request(key, input),
      TE.mapLeft(liftType<any | DbError>()),
      flatMap(flatTee(unitOfWork.save)),
    )
  },
)

export { loggingDecorator, uowDecorator }

type RequestDecorator = <TInput, TOutput, TError>(
  request: (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => AsyncResult<TOutput, TError>,
) => (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => AsyncResult<TOutput, TError>
