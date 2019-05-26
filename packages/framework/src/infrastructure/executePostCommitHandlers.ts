import { benchLog, getLogger } from "../utils"
import { NamedHandlerWithDependencies, requestInNewScopeType } from "./mediator"

const logger = getLogger("executePostCommitHandlers")

const executePostCommitHandlers = ({ executeIntegrationEvent }: { executeIntegrationEvent: requestInNewScopeType }) =>
  (eventsMap: Map<any, Array<NamedHandlerWithDependencies<any, any, any, any>>>) => {
    process.nextTick(async () => {
      try {
        for (const [evt, hndlrs] of eventsMap.entries()) {
          for (const pch of hndlrs) {
            const r = await benchLog(() => executeIntegrationEvent(pch, evt), "postCommitHandler")
            if (r && r.isErr()) {
              logger.warn(`Error during applying IntegrationEvents`, r)
            }
          }
        }
      } catch (err) {
        logger.error("Unexpected error during applying IntegrationEvents", err)
      }
    })
  }

export default executePostCommitHandlers
