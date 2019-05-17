import { ok, Result } from 'neverthrow'
import { PipeFunction } from '../utils/neverthrow-extensions'
import { IntegrationEventReturnType } from './misc'

// tslint:disable-next-line:max-classes-per-file
export default class DomainEventHandler {
  private events: any[] = []
  private integrationEvents: IntegrationEventReturnType[] = []

  constructor(private readonly publishEvents: PublishEventsType, private readonly executePostCommitHandlers: ExecutePostCommitHandlers) { }

  public async postEvents(getAndClearEvents: () => any[]): Promise<Result<IntegrationEventReturnType[], any>> {
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
        return r
      }
      integrationEvents = integrationEvents.concat(r.value)
      updateEvents()
    }
    this.integrationEvents = integrationEvents
    return ok(integrationEvents)
  }

  public publishPostCommitEventHandlers = () => {
    this.events = []
    if (this.integrationEvents.length) { this.executePostCommitHandlers(this.integrationEvents) }
  }
}

export type PublishEventsType = PipeFunction<any[], IntegrationEventReturnType[], any>
export type ExecutePostCommitHandlers = (postCommitEvents: IntegrationEventReturnType[]) => void
