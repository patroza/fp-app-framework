import { benchLog, logger } from "../utils"
import { IntegrationEventReturnType } from "./mediator"

const executePostCommitHandlers = (
  { setupChildContext }: { setupChildContext: <T>(cb: () => Promise<T>) => Promise<T> },
) => (postCommitHandlers: IntegrationEventReturnType[]) => {
  process.nextTick(async () => {
    try {
      for (const pch of postCommitHandlers) {
        const r = await setupChildContext(() => benchLog(pch, "postCommitHandler"))
        if (r && r.isErr()) {
          logger.warn(`Error during applying IntegrationEvents`, r)
        }
      }
    } catch (err) {
      logger.error("Unexpected error during applying IntegrationEvents", err)
    }
  })
}

export default executePostCommitHandlers
