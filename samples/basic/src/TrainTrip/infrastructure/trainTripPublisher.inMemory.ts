import { TrainTripPublisher } from '@/TrainTrip/eventhandlers'
import { TrainTripId } from '@/TrainTrip/TrainTrip'
import { requestType } from '@fp-app/framework/infrastructure/mediator'
import { logger } from '@fp-app/framework/utils'
import registerCloud from '../usecases/registerCloud'

export default class TrainTripPublisherInMemory implements TrainTripPublisher {
  private readonly map = new Map<TrainTripId, NodeJS.Timeout>()

  constructor(private readonly request: requestType) { }

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
      logger.log(`Publishing TrainTrip to Cloud: ${trainTripId}`)
      // Talk to the Cloud Service to sync with Cloud
      const result = await this.request(registerCloud, { trainTripId })
      if (result.isErr()) {
        // TODO: really handle error
        logger.error(result.error)
      }
    } catch (err) {
      // TODO: really handle error
      logger.error(err)
    } finally {
      this.map.delete(trainTripId)
    }
  }

  private trainTripIsPending(trainTripID: TrainTripId) { return this.map.has(trainTripID) }
}

export interface IntegrationEventCommands { registerCloud: typeof registerCloud }

const CLOUD_PUBLISH_DELAY = 10 * 1000
