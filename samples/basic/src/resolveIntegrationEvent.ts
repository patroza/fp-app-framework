import { EventDTO, logger, resolveEventType } from "@fp-app/framework"
import { CustomerRequestedChanges } from "./TrainTrip/eventhandlers/integration.events"

const resolveEvent = (): resolveEventType => (evt: IntegrationEvents) => {
  logger.log("Received integration event", evt.type, evt.payload)

  switch (evt.type) {
    case "CustomerRequestedChanges":
      return new CustomerRequestedChanges(
        evt.payload.trainTripId,
        evt.payload.itineraryId,
      )
    default: {
      logger.warn("Received event, but have no handler: ", evt)
      return undefined
    }
  }
}

export interface CustomerRequestedChangesDTO extends EventDTO {
  type: "CustomerRequestedChanges"
  payload: { trainTripId: string; itineraryId: string }
}
type IntegrationEvents = CustomerRequestedChangesDTO

export default resolveEvent
