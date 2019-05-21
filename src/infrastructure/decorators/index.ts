import { benchLog, logger } from '../../utils'
import { flatMap, flatTee } from '../../utils/neverthrow-extensions'
import { UnitOfWork } from '../context.base'

export const loggingDecorator = () =>
  (publisher: any) =>
    (key: any, input: any) => benchLog(async () => {
      const t = key.isCommand ? 'Command' : 'Query'
      const prefix = `${key.name} ${t}`
      logger.log(`${prefix} input`, input)
      const result = await publisher(key, input)
      logger.log(`${prefix} result`, result)
      return result
    }, key.name)

export const uowDecorator = (unitOfWork: UnitOfWork) =>
  (publisher: any) =>
    (key: any, input: any) => {
      if (!key.isCommand) {
        return publisher(key, input)
      }

      return publisher(key, input)
        .pipe(
          // mapErr(liftType<TErr | DbError>()),
          flatMap(flatTee(unitOfWork.save)),
        )
    }
