import { liftType, AsyncResult, TE, pipe, chainTeeTask } from "@fp-app/fp-ts-extensions"
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
          const r = request(key, input)
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
    if (
      key[requestTypeSymbol] !== "COMMAND" &&
      key[requestTypeSymbol] !== "INTEGRATIONEVENT"
    ) {
      return request(key, input)
    }

    return pipe(
      request(key, input),
      TE.mapLeft(liftType<any | DbError>()),
      chainTeeTask(() =>
        pipe(unitOfWork.save(), TE.mapLeft(liftType<any | DbError>())),
      ),
    )
  },
)

export { loggingDecorator, uowDecorator }

type RequestDecorator = <TInput, TOutput, TError>(
  request: (
    key: NamedRequestHandler<TInput, TOutput, TError>,
    input: TInput,
  ) => AsyncResult<TOutput, TError>,
) => (
  key: NamedRequestHandler<TInput, TOutput, TError>,
  input: TInput,
) => AsyncResult<TOutput, TError>
