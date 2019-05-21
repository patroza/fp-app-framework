import { err, map, PipeFunction, Result, tee } from '../utils/neverthrow-extensions'
import { IntegrationEventReturnType } from './mediator'
import { generateKey } from './SimpleContainer'

// tslint:disable-next-line:max-classes-per-file
export default class DomainEventHandler {
  private events: any[] = []
  private integrationEvents: IntegrationEventReturnType[] = []

  constructor(
    private readonly publishEvents: typeof publishEventsKey,
    private readonly executeIntegrationEvents: typeof executePostCommitHandlersKey,
  ) { }

  async commitAndPostEvents<T, TErr>(
    getAndClearEvents: () => any[],
    commit: () => Promise<Result<T, TErr>>,
  ): Promise<Result<T, TErr>> {
    // 1. pre-commit: post domain events
    // 2. commit!
    // 3. post-commit: post integration events

    this.integrationEvents = []
    const updateEvents = () => this.events = this.events.concat(getAndClearEvents())
    updateEvents()
    let processedEvents: any[] = []
    let integrationEvents: IntegrationEventReturnType[] = []
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
      integrationEvents = integrationEvents.concat(r.value)
      updateEvents()
    }
    this.integrationEvents = integrationEvents
    return await commit()
      .pipe(tee(map(this.publishIntegrationEvents)))
  }

  private readonly publishIntegrationEvents = () => {
    this.events = []
    if (this.integrationEvents.length) { this.executeIntegrationEvents(this.integrationEvents) }
    this.integrationEvents = []
  }
}

export const publishEventsKey = generateKey<PipeFunction<any[], IntegrationEventReturnType[], any>>()
export const executePostCommitHandlersKey = generateKey<(postCommitEvents: IntegrationEventReturnType[]) => void>()
