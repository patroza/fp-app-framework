import { TrainTripPublisher } from "@/TrainTrip/eventhandlers"
import { TrainTripId } from "@/TrainTrip/TrainTrip"
import { paramInject, requestInNewScopeKey, requestInNewScopeType } from "@fp-app/framework"
import { getLogger } from "@fp-app/framework"
import registerCloud from "../usecases/registerCloud"

export default class TrainTripPublisherInMemory implements TrainTripPublisher {
  private readonly map = new Map<TrainTripId, NodeJS.Timeout>()
  // TODO: easy way how to inject a configured logger
  // ie the key is 'configuredLogger', and it will be configured based on the
  // function/class.
  private readonly logger = getLogger(this.constructor.name)

  constructor(
    @paramInject(requestInNewScopeKey) private readonly request: requestInNewScopeType,
  ) { }

  registerIfPending = async (trainTripId: TrainTripId) => {
    if (!this.trainTripIsPending(trainTripId)) { return }
    return await this.register(trainTripId)
  }

  register = async (trainTripId: TrainTripId) => {
    const current = this.map.get(trainTripId)
    if (current) { clearTimeout(current) }
    this.map.set(
      trainTripId,
      setTimeout(() => this.tryPublishTrainTrip(trainTripId), CLOUD_PUBLISH_DELAY),
    )
  }

  private tryPublishTrainTrip = async (trainTripId: string) => {
    try {
      this.logger.log(`Publishing TrainTrip to Cloud: ${trainTripId}`)
      // Talk to the Cloud Service to sync with Cloud
      const result = await this.request(registerCloud, { trainTripId })
      if (result.isErr()) {
        // TODO: really handle error
        this.logger.error(result.error)
      }
    } catch (err) {
      // TODO: really handle error
      this.logger.error(err)
    } finally {
      this.map.delete(trainTripId)
    }
  }

  private trainTripIsPending(trainTripID: TrainTripId) { return this.map.has(trainTripID) }
}

export interface IntegrationEventCommands { registerCloud: typeof registerCloud }

const CLOUD_PUBLISH_DELAY = 10 * 1000
