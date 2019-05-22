import { flatMap, flatTee, liftType, mapErr, Result } from '@fp-app/neverthrow-extensions'
import { benchLog, logger } from '../../utils'
import { UnitOfWork } from '../context.base'
import { DbError } from '../errors'
import { NamedRequestHandler } from '../mediator'

export const loggingDecorator = (): RequestDecorator =>
  request =>
    (key, input) => {
      const prefix = `${key.name} ${key.isCommand ? 'Command' : 'Query'}`
      return benchLog(async () => {
        logger.log(`${prefix} input`, input)
        const result = await request(key, input)
        logger.log(`${prefix} result`, result)
        return result
      }, prefix)
    }

export const uowDecorator = (unitOfWork: UnitOfWork): RequestDecorator =>
  request =>
    (key, input) => {
      if (!key.isCommand) {
        return request(key, input)
      }

      return request(key, input)
        .pipe(
          mapErr(liftType<any | DbError>()),
          flatMap(flatTee(unitOfWork.save)),
        )
    }

type RequestDecorator = <TInput, TOutput, TError>(
  request: (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) =>
    Promise<Result<TOutput, TError>>) =>
  (key: NamedRequestHandler<TInput, TOutput, TError>, input: TInput) => Promise<Result<TOutput, TError>>
