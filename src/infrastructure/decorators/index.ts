import { benchLog, logger } from '../../utils'
import { flatMap, flatTee, liftType, mapErr, Result } from '../../utils/neverthrow-extensions'
import { UnitOfWork } from '../context.base'
import { DbError } from '../errors'
import { NamedRequestHandler } from '../mediator'

export const loggingDecorator = (): RequestDecorator =>
  (publisher: any) =>
    (key: any, input: any) => benchLog(async () => {
      const t = key.isCommand ? 'Command' : 'Query'
      const prefix = `${key.name} ${t}`
      logger.log(`${prefix} input`, input)
      const result = await publisher(key, input)
      logger.log(`${prefix} result`, result)
      return result
    }, key.name)

export const uowDecorator = (unitOfWork: UnitOfWork): RequestDecorator => publisher =>
  (key, input) => {
    if (!key.isCommand) {
      return publisher(key, input)
    }

    return publisher(key, input)
      .pipe(
        mapErr(liftType<any | DbError>()),
        flatMap(flatTee(unitOfWork.save)),
      )
  }

type RequestDecorator = <TInput, TOutput, TError>(
  publisher: (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) =>
    Promise<Result<TOutput, TError>>) =>
  (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => Promise<Result<TOutput, TError>>
