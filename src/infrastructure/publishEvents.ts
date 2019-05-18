import { err, ok, Result } from 'neverthrow'
import { PublishEventsTypeKey } from '../infrastructure/domainEventHandler'
import { DomainEventReturnType, IntegrationEventReturnType } from '../infrastructure/misc'
import { isTruthyFilter, logger } from '../utils'
import { PipeFunction } from '../utils/neverthrow-extensions'

const publishEvents = (handlers: EventHandlerMap): typeof PublishEventsTypeKey => async events => {
  const values: DomainEventReturnType[] = []
  for (const evt of events) {
    const r = await processEvent(evt, handlers)
    if (!r) { continue }
    if (r.isErr()) { return err(r) }
    r.value.forEach(x => values.push(x))
  }
  const mapped = values.filter(isTruthyFilter)
  return ok(mapped)
}

export default publishEvents

// TODO: Excellent usecase for a Mediator
const processEvent = async (evt: any, handlers: EventHandlerMap): Promise<Result<IntegrationEventReturnType[], any>> => {
  const hndl = handlers.get(evt.constructor)
  logger.log(`Publishing Domain event: ${evt.constructor.name} ${hndl ? hndl.length : 0} handlers ${JSON.stringify(evt)}`)
  const commitHandlers: IntegrationEventReturnType[] = []
  if (!hndl) { return ok(commitHandlers) }
  for (const createHandler of hndl) {
    const h = createHandler()
    const r = await h(evt)
    if (r.isErr()) { return err(r.error) }
    if (r.value) { commitHandlers.push(r.value) }
  }
  logger.log(`Published Domain event: ${evt.constructor.name} ${commitHandlers.length} integration events`)
  return ok(commitHandlers)
}

type EventHandlerMap = Map<any, EventHandlerFactory[]>
export type EventHandlerFactory = () => PipeFunction<any, any, any>
