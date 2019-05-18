import { IntegrationEventReturnType } from '../infrastructure/misc'
import { benchLog, logger } from '../utils'

const executePostCommitHandlers = (
  {setupChildContext}: {setupChildContext: <T>(cb: () => Promise<T>) => Promise<T>},
) => (postCommitHandlers: IntegrationEventReturnType[]) => {
  process.nextTick(async () => {
    try {
      for (const pch of postCommitHandlers) {
        const r = await setupChildContext(() => benchLog(pch, 'postCommitHandler'))
        if (r && r.isErr()) {
          logger.warn(`Error during applying IntegrationEvents`, r)
        }
      }
    } catch (err) {
      logger.error('Unexpected error during applying IntegrationEvents', err)
    }
  })
}

export default executePostCommitHandlers
