import Event from "../event"
import { publishType } from "./mediator"
import { generateKey } from "./SimpleContainer"

const processReceivedEvent = ({ publish, resolveEvent }: {
  resolveEvent: resolveEventType,
  publish: publishType,
}) => async (body: string) => {
  const { type, payload } = JSON.parse(body) as EventDTO
  const event = resolveEvent({ type, payload })
  if (!event) { return }
  await publish(event)
}

export interface EventDTO { type: string, payload: any }

const createEventDTO = (evt: Event): EventDTO => {
  return {
    payload: evt,
    type: evt.constructor.name,
  }
}

type resolveEventType = (evt: { type: any, payload: any }) => Event | undefined
const resolveEventKey = generateKey<resolveEventType>("resolveEvent")

export {
  createEventDTO,
  processReceivedEvent,
  resolveEventKey,
  resolveEventType,
}
