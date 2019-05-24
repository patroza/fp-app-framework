import { flatMap, flatTee, liftType, mapErr, Result } from "@fp-app/neverthrow-extensions"
import { benchLog, logger } from "../../utils"
import { DbError } from "../errors"
import { configureDependencies, NamedRequestHandler, UOWKey } from "../mediator"

export const loggingDecorator = (): RequestDecorator =>
  request =>
    (key, input) => {
      const prefix = `${key.name} ${key.type}`
      return benchLog(async () => {
        logger.log(`${prefix} input`, input)
        const result = await request(key, input)
        logger.log(`${prefix} result`, result)
        return result
      }, prefix)
    }

export const uowDecorator = configureDependencies({ unitOfWork: UOWKey }, ({ unitOfWork }): RequestDecorator =>
  request =>
    (key, input) => {
      if (key.type !== "COMMAND" && key.type !== "INTEGRATIONEVENT") {
        return request(key, input)
      }

      return request(key, input)
        .pipe(
          mapErr(liftType<any | DbError>()),
          flatMap(flatTee(unitOfWork.save)),
        )
    },
)

type RequestDecorator = <TInput, TOutput, TError>(
  request: (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) =>
    Promise<Result<TOutput, TError>>) =>
  (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => Promise<Result<TOutput, TError>>
