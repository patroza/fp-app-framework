import { err, ok, PipeFunction, PipeFunctionN, Result } from 'fp-app-framework/utils/neverthrow-extensions'

import { logger } from 'fp-app-framework/utils'

const publish = (getMany: <TInput>(evt: TInput) => Array<PipeFunction<TInput, DomainEventReturnType, Error>>): publishType =>
  async <TInput>(evt: TInput) => {
    const hndl = getMany(evt)
    logger.log(`Publishing Domain event: ${evt.constructor.name} (${hndl ? hndl.length : 0} handlers)`, JSON.stringify(evt))

    const commitHandlers: IntegrationEventReturnType[] = []
    if (!hndl) { return ok(commitHandlers) }

    for (const evtHandler of hndl) {
      logger.log(`Handling ${evtHandler.name}`)
      const r = await evtHandler(evt)
      if (r.isErr()) { return err(r.error) }
      if (r.value) { commitHandlers.push(r.value) }
    }

    logger.log(`Published Domain event: ${evt.constructor.name} (${commitHandlers.length} integration events)`)
    return ok(commitHandlers)
  }

export default publish

// tslint:disable-next-line:max-line-length
export type publishType = <TInput>(evt: TInput) => Promise<Result<IntegrationEventReturnType[], Error>>

export type DomainEventReturnType = void | IntegrationEventReturnType
export type IntegrationEventReturnType = PipeFunctionN<void, Error>