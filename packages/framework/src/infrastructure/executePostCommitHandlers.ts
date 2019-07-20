import { benchLog, getLogger } from "../utils"
import { NamedHandlerWithDependencies, requestInNewScopeType } from "./mediator"
import { pipe, TE } from "@fp-app/fp-ts-extensions"

const logger = getLogger("executePostCommitHandlers")

const executePostCommitHandlers = ({ executeIntegrationEvent }: { executeIntegrationEvent: requestInNewScopeType }) => (
  eventsMap: eventsMapType,
) =>
  process.nextTick(async () => {
    try {
      await tryProcessEvents(executeIntegrationEvent, eventsMap)
    } catch (err) {
      logger.error("Unexpected error during applying IntegrationEvents", err)
    }
  })

async function tryProcessEvents(executeIntegrationEvent: requestInNewScopeType, eventsMap: eventsMapType) {
  for (const [evt, hndlrs] of eventsMap.entries()) {
    for (const pch of hndlrs) {
      await benchLog(
        () =>
          pipe(
            executeIntegrationEvent(pch, evt),
            TE.mapLeft(err => logger.warn(`Error during applying IntegrationEvents`, err)),
          )(),
        "postCommitHandler",
      )
    }
  }
}

type eventsMapType = Map<any, NamedHandlerWithDependencies<any, any, any, any>[]>

export default executePostCommitHandlers
