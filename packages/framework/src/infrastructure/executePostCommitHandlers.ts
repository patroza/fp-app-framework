import { benchLog, logger, PipeFunction } from "../utils"
import { EventHandlerWithDependencies } from "./mediator"

const executePostCommitHandlers = (
  { get, setupChildContext }: {
    get: (evt: any) => PipeFunction<any, any, any>,
    setupChildContext: <T>(cb: () => Promise<T>) => Promise<T>,
  },
) => (eventsMap: Map<any, Array<EventHandlerWithDependencies<any, any, any, any>>>) => {
  process.nextTick(async () => {
    try {
      for (const [evt, hndlrs] of eventsMap.entries()) {
        if (hndlrs.length) {
          for (const pch of hndlrs) {
            const r = await setupChildContext(() => benchLog(() => get(pch)(evt), "postCommitHandler"))
            if (r && r.isErr()) {
              logger.warn(`Error during applying IntegrationEvents`, r)
            }
          }
        }
      }
    } catch (err) {
      logger.error("Unexpected error during applying IntegrationEvents", err)
    }
  })
}

export default executePostCommitHandlers
