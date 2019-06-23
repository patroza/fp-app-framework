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

const loggingDecorator = (): RequestDecorator => request => (key, input) => {
  const prefix = `${key.name} ${key[requestTypeSymbol]}`
  return () =>
    benchLog(
      () =>
        using(logger.addToLoggingContext({ request: prefix }), async () => {
          logger.log(`${prefix} input`, input)
          console.log("$$$ hmm1", request)
          const r = request(key, input)
          console.log("$$$ hmm", r)
          const result = await r()
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
      TE.chain(flatTee(unitOfWork.save)),
    )
  },
)

export { loggingDecorator, uowDecorator }

type RequestDecorator = <TInput, TOutput, TError>(
  request: (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => AsyncResult<TOutput, TError>,
) => (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => AsyncResult<TOutput, TError>
