import { err, map, Result, success, tee } from "@fp-app/neverthrow-extensions"
import { EventHandlerWithDependencies } from "./mediator"
import { publishType } from "./mediator/publish"
import { generateKey } from "./SimpleContainer"

// tslint:disable-next-line:max-classes-per-file
export default class DomainEventHandler {
  private events: any[] = []
  private processedEvents: any[] = []

  constructor(
    private readonly publish: publishType,
    private readonly getIntegrationHandlers: (evt: any) => Array<EventHandlerWithDependencies<any, any, any, any>> | undefined,
    private readonly executeIntegrationEvents: typeof executePostCommitHandlersKey,
  ) { }

  // Note: Eventhandlers in this case have unbound errors..
  async commitAndPostEvents<T, TErr>(
    getAndClearEvents: () => any[],
    commit: () => Promise<Result<T, TErr>>,
  ): Promise<Result<T, TErr | Error>> {
    // 1. pre-commit: post domain events
    // 2. commit!
    // 3. post-commit: post integration events

    this.processedEvents = []
    const updateEvents = () => this.events = this.events.concat(getAndClearEvents())
    updateEvents()
    let processedEvents: any[] = []
    // loop until we have all events captured, event events of events.
    // lets hope we don't get stuck in stackoverflow ;-)
    while (this.events.length) {
      const events = this.events
      this.events = []
      processedEvents = processedEvents.concat(events)
      const r = await this.publishEvents(events)
      if (r.isErr()) {
        this.events = processedEvents
        return err(r.error)
      }
      updateEvents()
    }
    this.processedEvents = processedEvents
    return await commit()
      .pipe(tee(map(this.publishIntegrationEvents)))
  }

  private readonly publishEvents = async (events: any[]): Promise<Result<void, Error>> => {
    for (const evt of events) {
      const r = await this.publish(evt)
      if (r.isErr()) { return err(r.error) }
    }
    return success()
  }

  private readonly publishIntegrationEvents = () => {
    this.events = []
    const integrationEventsMap = new Map<any, Array<EventHandlerWithDependencies<any, any, any, any>>>()
    for (const evt of this.processedEvents) {
      const integrationEventHandlers = this.getIntegrationHandlers(evt)
      if (!integrationEventHandlers || !integrationEventHandlers.length) { continue }
      integrationEventsMap.set(evt, integrationEventHandlers)
    }
    if (integrationEventsMap.size) { this.executeIntegrationEvents(integrationEventsMap) }
    this.processedEvents = []
  }
}

export const executePostCommitHandlersKey = generateKey<(eventMap: Map<any, Array<EventHandlerWithDependencies<any, any, any, any>>>) => void>(
  "executePostCommitHandlers",
)
