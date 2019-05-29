import { benchLog, getLogger } from "../utils"
import { NamedHandlerWithDependencies, requestInNewScopeType } from "./mediator"

const logger = getLogger("executePostCommitHandlers")

const executePostCommitHandlers = ({ executeIntegrationEvent }: { executeIntegrationEvent: requestInNewScopeType }) =>
  (eventsMap: eventsMapType) => process.nextTick(async () => {
    try {
      await tryProcessEvents(executeIntegrationEvent, eventsMap)
    } catch (err) {
      logger.error("Unexpected error during applying IntegrationEvents", err)
    }
  })

async function tryProcessEvents(executeIntegrationEvent: requestInNewScopeType, eventsMap: eventsMapType) {
  for (const [evt, hndlrs] of eventsMap.entries()) {
    for (const pch of hndlrs) {
      const r = await benchLog(() => executeIntegrationEvent(pch, evt), "postCommitHandler")
      if (r.isErr()) { logger.warn(`Error during applying IntegrationEvents`, r) }
    }
  }
}

type eventsMapType = Map<any, Array<NamedHandlerWithDependencies<any, any, any, any>>>

export default executePostCommitHandlers
