import { publishEventsKey } from '../infrastructure/domainEventHandler'
import { DomainEventReturnType, IntegrationEventReturnType } from '../infrastructure/misc'
import { isTruthyFilter, logger } from '../utils'
import { err, ok, PipeFunction, Result } from '../utils/neverthrow-extensions'

// tslint:disable-next-line:max-line-length
export type publishType = <TInput, TOutput, TError>(eventHandler: PipeFunction<TInput, TOutput, TError>, event: TInput) => Promise<Result<TOutput, TError>>

const publishEvents = (handlers: EventHandlerMap, publish: publishType): typeof publishEventsKey =>
  async events => {
    const values: DomainEventReturnType[] = []
    for (const evt of events) {
      const r = await processEvent(evt, handlers, publish)
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
  publish: publishType,
): Promise<IntegrationEventResult> => {
  const hndl = handlers.get(evt.constructor)

  logger.log(`Publishing Domain event: ${evt.constructor.name} (${hndl ? hndl.length : 0} handlers)`, JSON.stringify(evt))

  const commitHandlers: IntegrationEventReturnType[] = []
  if (!hndl) { return ok(commitHandlers) }

  for (const evtHandler of hndl) {
    logger.log(`Handling ${evtHandler.name}`)
    const r = await publish(evtHandler, evt)
    if (r.isErr()) { return err(r.error) }
    if (r.value) { commitHandlers.push(r.value) }
  }

  logger.log(`Published Domain event: ${evt.constructor.name} (${commitHandlers.length} integration events)`)
  return ok(commitHandlers)
}

type IntegrationEventResult = Result<IntegrationEventReturnType[], any>

type EventHandlerMap = Map<any, Array<PipeFunction<any, any, any>>>
export type CreateHandlerType = (hndlr: any) => PipeFunction<any, any, any>
