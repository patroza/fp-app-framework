import {
  err,
  success,
  pipe,
  AsyncResult,
  E,
  isErr,
  tee,
} from "@fp-app/fp-ts-extensions"
import Event from "../event"
import { EventHandlerWithDependencies } from "./mediator"
import { publishType } from "./mediator/publish"
import { generateKey } from "./SimpleContainer"

// tslint:disable-next-line:max-classes-per-file
export default class DomainEventHandler {
  private events: Event[] = []
  private processedEvents: Event[] = []

  constructor(
    private readonly publish: publishType,
    private readonly getIntegrationHandlers: (
      evt: Event,
    ) => EventHandlerWithDependencies<any, any, any, any>[] | undefined,
    private readonly executeIntegrationEvents: typeof executePostCommitHandlersKey,
  ) {}

  // Note: Eventhandlers in this case have unbound errors..
  commitAndPostEvents<T, TErr>(
    getAndClearEvents: () => Event[],
    commit: () => AsyncResult<T, TErr>,
  ): AsyncResult<T, TErr | Error> {
    return async () => {
      // 1. pre-commit: post domain events
      // 2. commit!
      // 3. post-commit: post integration events

      this.processedEvents = []
      const updateEvents = () => (this.events = this.events.concat(getAndClearEvents()))
      updateEvents()
      let processedEvents: Event[] = []
      // loop until we have all events captured, event events of events.
      // lets hope we don't get stuck in stackoverflow ;-)
      while (this.events.length) {
        const events = this.events
        this.events = []
        processedEvents = processedEvents.concat(events)
        const r = await this.publishEvents(events)()
        if (isErr(r)) {
          this.events = processedEvents
          return err(r.left)
        }
        updateEvents()
      }
      this.processedEvents = processedEvents
      return pipe(await commit()(), E.map(tee(() => this.publishIntegrationEvents())))
    }
  }

  private readonly publishEvents = (events: Event[]): AsyncResult<void, Error> => {
    return async () => {
      for (const evt of events) {
        const r = await this.publish(evt)()
        if (isErr(r)) {
          return err(r.left)
        }
      }
      return success()
    }
  }

  private readonly publishIntegrationEvents = () => {
    this.events = []
    const integrationEventsMap = new Map<
      any,
      EventHandlerWithDependencies<any, any, any, any>[]
    >()
    for (const evt of this.processedEvents) {
      const integrationEventHandlers = this.getIntegrationHandlers(evt)
      if (!integrationEventHandlers || !integrationEventHandlers.length) {
        continue
      }
      integrationEventsMap.set(evt, integrationEventHandlers)
    }
    if (integrationEventsMap.size) {
      this.executeIntegrationEvents(integrationEventsMap)
    }
    this.processedEvents = []
  }
}

export const executePostCommitHandlersKey = generateKey<
  (eventMap: Map<any, EventHandlerWithDependencies<any, any, any, any>[]>) => void
>("executePostCommitHandlers")
