import { err, ok, Result } from 'neverthrow'
import { publishEventsKey } from '../infrastructure/domainEventHandler'
import { DomainEventReturnType, IntegrationEventReturnType } from '../infrastructure/misc'
import { isTruthyFilter, logger } from '../utils'
import { PipeFunction } from '../utils/neverthrow-extensions'
import { UsecaseHandlerTuple } from './requestHandlers'

const publishEvents = (handlers: EventHandlerMap, resolve: CreateHandlerType): typeof publishEventsKey =>
  async events => {
    const values: DomainEventReturnType[] = []
    for (const evt of events) {
      const r = await processEvent(evt, handlers, resolve)
      if (!r) { continue }
      if (r.isErr()) { return err(r) }
      r.value.forEach(x => values.push(x))
    }
    const mapped = values.filter(isTruthyFilter)
    return ok(mapped)
  }

export default publishEvents

const processEvent = async (
  evt: any,
  handlers: EventHandlerMap,
  createHandler: CreateHandlerType,
): Promise<IntegrationEventResult> => {
  const hndl = handlers.get(evt.constructor)

  logger.log(`Publishing Domain event: ${evt.constructor.name} (${hndl ? hndl.length : 0} handlers)`, JSON.stringify(evt))

  const commitHandlers: IntegrationEventReturnType[] = []
  if (!hndl) { return ok(commitHandlers) }

  for (const evtHandler of hndl) {
    const h = createHandler(evtHandler)
    logger.log(`Handling ${evtHandler[3].name}`)
    const r = await h(evt)
    if (r.isErr()) { return err(r.error) }
    if (r.value) { commitHandlers.push(r.value) }
  }

  logger.log(`Published Domain event: ${evt.constructor.name} (${commitHandlers.length} integration events)`)
  return ok(commitHandlers)
}

type IntegrationEventResult = Result<IntegrationEventReturnType[], any>

type EventHandlerMap = Map<any, Array<UsecaseHandlerTuple<any, any, any, any>>>
export type CreateHandlerType = (hndlr: UsecaseHandlerTuple<any, any, any, any>) => PipeFunction<any, any, any>
