import { TrainTripCreated, TrainTripId, TrainTripStateChanged, UserInputReceived } from '@/TrainTrip/TrainTrip'
import { DbContextKey, defaultDependencies, getTripKey, TrainTripPublisherKey } from '@/TrainTrip/usecases/types'
import { DbError } from '@fp-app/framework/infrastructure/errors'
import { createEventHandlerWithDeps, IntegrationEventReturnType } from '@fp-app/framework/infrastructure/mediator'
import { flatMap, map, ok, pipe, toTup } from '@fp-app/framework/utils/neverthrow-extensions'

// Domain Events should primarily be used to be turned into Integration Event (Post-Commit, call other service)
// There may be other small reasons to use it, like to talk to an external system Pre-Commit.
// Otherwise they just add additional layers of indirection and take behavior away often more suited for the Aggregrates/root.
// Informing other bounded contexts, generally should not occur within the same transaction, and should thus be handled
// by turning into Integration Events.

// Ideas: Store Integration Events into the database within the same Commit, and process them in an outside service.
// So that we may ensure the events will be processed.
// Other options can be to have a compensating action running regularly that checks and fixes things. A sort of eventual consistency.

// There are some pitfalls: when turning into an integration event callback
// one should generally not access dependencies that were passed into the domain event :/
// because of possible scope mismatch issues (ie a db context should be closed after a request has finished processing).
// Below implementations violate this principal, at the time of writing ;-)
// (trainTripPublisher is passed in as part of the domain event handler, and used by the integration event handler)

const createEventHandler = createEventHandlerWithDeps({ trainTripPublisher: TrainTripPublisherKey, ...defaultDependencies })

createEventHandler<TrainTripCreated, IntegrationEventReturnType, any>(
  /* on */ TrainTripCreated, 'ScheduleCloudSync',
  ({ trainTripPublisher }) => pipe(
    map(createRegisterIntegrationEvent(trainTripPublisher)),
  ),
)

createEventHandler<TrainTripStateChanged, IntegrationEventReturnType, any>(
  /* on */ TrainTripStateChanged, 'EitherDebounceOrScheduleCloudSync',
  ({ trainTripPublisher }) => pipe(
    map(createRegisterIntegrationEvent(trainTripPublisher)),
  ),
)

const createEventHandler2 = createEventHandlerWithDeps({ db: DbContextKey, getTrip: getTripKey })

createEventHandler2<TrainTripStateChanged, void, DbError>(
  /* on */ TrainTripStateChanged, 'RefreshTripInfo',
  ({ db, getTrip }) => pipe(
    flatMap(({ id }) => db.trainTrips.load(id)),
    flatMap(toTup(trainTrip => getTrip(trainTrip.currentTravelClassConfiguration.travelClass.templateId))),
    map(([trip, trainTrip]) => trainTrip.updateTrip(trip)),
  ),
)

createEventHandler<UserInputReceived, IntegrationEventReturnType, any>(
  /* on */ UserInputReceived, 'DebouncePendingCloudSync',
  ({ trainTripPublisher }) => pipe(
    map(createRegisterIfPendingIntegrationEvent(trainTripPublisher)),
  ),
)

export interface TrainTripPublisher {
  registerIfPending(trainTripId: TrainTripId): Promise<void>
  register(trainTripId: TrainTripId): Promise<void>
}

const createRegisterIntegrationEvent = (trainTripPublisher: TrainTripPublisher) =>
  (event: TrainTripStateChanged): IntegrationEventReturnType =>
    async () => ok(await trainTripPublisher.register(event.id))

const createRegisterIfPendingIntegrationEvent = (trainTripPublisher: TrainTripPublisher) =>
  (event: TrainTripStateChanged): IntegrationEventReturnType =>
    async () => ok(await trainTripPublisher.registerIfPending(event.id))
