import Event from "../event"
import { publishType, resolveEventType } from "./mediator"

const processReceivedEvent = ({
  publish,
  resolveEvent,
}: {
  resolveEvent: resolveEventType
  publish: publishType
}) => async (body: string) => {
  const { payload, type } = JSON.parse(body) as EventDTO
  const event = resolveEvent({ type, payload })
  if (!event) {
    return
  }
  // TODO: process the result
  return await publish(event)()
}

export interface EventDTO {
  type: string
  payload: any
}

const createEventDTO = (evt: Event): EventDTO => ({
  payload: evt,
  type: evt.constructor.name,
})

export { createEventDTO, processReceivedEvent }
