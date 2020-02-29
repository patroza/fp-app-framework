import {
  err,
  PipeFunction,
  PipeFunctionN,
  success,
  AsyncResult,
  isErr,
} from "@fp-app/fp-ts-extensions"

import Event from "../../event"
import { getLogger } from "../../utils"

const logger = getLogger("publish")

const publish = (
  getMany: <TInput extends Event>(
    evt: TInput,
  ) => PipeFunction<TInput, DomainEventReturnType, Error>[],
): publishType => <TInput extends Event>(evt: TInput) => async () => {
  const hndl = getMany(evt)
  logger.log(
    `Publishing Domain event: ${evt.constructor.name} (${
      hndl ? hndl.length : 0
    } handlers)`,
    JSON.stringify(evt),
  )

  if (!hndl) {
    return success()
  }

  for (const evtHandler of hndl) {
    logger.log(`Handling ${evtHandler.name}`)
    const r = await evtHandler(evt)()
    if (isErr(r)) {
      return err(r.left)
    }
  }

  logger.log(`Published event: ${evt.constructor.name}`)
  return success()
}

export default publish

// tslint:disable-next-line:max-line-length
export type publishType = <TInput extends Event>(
  evt: TInput,
) => AsyncResult<void, Error>

export type DomainEventReturnType = void | IntegrationEventReturnType
export interface IntegrationEventReturnType {
  consistency?: "eventual" | "strict"
  handler: PipeFunctionN<void, Error>
}
