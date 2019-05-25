import { err, PipeFunction, PipeFunctionN, Result, success } from "@fp-app/neverthrow-extensions"

import { Constructor, getLogger } from "../../utils"

const logger = getLogger("publish")

const publish = (getMany: <TInput extends Constructor<any>>(evt: TInput) => Array<PipeFunction<TInput, DomainEventReturnType, Error>>): publishType =>
  async <TInput extends Constructor<any>>(evt: TInput) => {
    const hndl = getMany(evt)
    logger.log(`Publishing Domain event: ${evt.constructor.name} (${hndl ? hndl.length : 0} handlers)`, JSON.stringify(evt))

    if (!hndl) { return success() }

    for (const evtHandler of hndl) {
      logger.log(`Handling ${evtHandler.name}`)
      const r = await evtHandler(evt)
      if (r.isErr()) { return err(r.error) }
    }

    logger.log(`Published event: ${evt.constructor.name}`)
    return success()
  }

export default publish

// tslint:disable-next-line:max-line-length
export type publishType = <TInput extends Constructor<any>>(evt: TInput) => Promise<Result<void, Error>>

export type DomainEventReturnType = void | IntegrationEventReturnType
export interface IntegrationEventReturnType {
  consistency?: "eventual" | "strict",
  handler: PipeFunctionN<void, Error>
}
