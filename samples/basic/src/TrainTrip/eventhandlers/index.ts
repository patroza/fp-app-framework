import {
  TrainTripCreated,
  TrainTripId,
  TrainTripStateChanged,
  UserInputReceived,
} from "@/TrainTrip/TrainTrip"
import {
  DbContextKey,
  defaultDependencies,
  getTripKey,
  TrainTripPublisherKey,
} from "@/TrainTrip/usecases/types"
import {
  createDomainEventHandlerWithDeps,
  createIntegrationEventHandlerWithDeps,
  curryRequest,
  DbError,
  requestKey,
  ApiError,
  InvalidStateError,
} from "@fp-app/framework"
import { pipe, TE, E, liftType, compose } from "@fp-app/fp-ts-extensions"
import lockTrainTrip from "../usecases/lockTrainTrip"
import { CustomerRequestedChanges } from "./integration.events"

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

const createIntegrationEventHandler = createIntegrationEventHandlerWithDeps({
  trainTripPublisher: TrainTripPublisherKey,
  ...defaultDependencies,
})

createIntegrationEventHandler<TrainTripCreated, void, never>(
  /* on */ TrainTripCreated,
  "ScheduleCloudSync",
  ({ trainTripPublisher }) =>
    compose(
      TE.chain(({ trainTripId }) => async () =>
        E.right(await trainTripPublisher.register(trainTripId)),
      ),
    ),
)

createIntegrationEventHandler<TrainTripStateChanged, void, never>(
  /* on */ TrainTripStateChanged,
  "EitherDebounceOrScheduleCloudSync",
  ({ trainTripPublisher }) =>
    compose(
      TE.chain(({ trainTripId }) => async () =>
        E.right(await trainTripPublisher.register(trainTripId)),
      ),
    ),
)

const createDomainEventHandler = createDomainEventHandlerWithDeps({
  db: DbContextKey,
  getTrip: getTripKey,
})

createDomainEventHandler<TrainTripStateChanged, void, RefreshTripInfoError>(
  /* on */ TrainTripStateChanged,
  "RefreshTripInfo",
  ({ db, getTrip }) =>
    compose(
      TE.chain(({ trainTripId }) =>
        pipe(
          db.trainTrips.load(trainTripId),
          TE.mapLeft(liftType<RefreshTripInfoError>()),
        ),
      ),
      TE.chain(trainTrip =>
        pipe(
          getTrip(trainTrip.currentTravelClassConfiguration.travelClass.templateId),
          TE.map(trip => trainTrip.updateTrip(trip)),
          TE.mapLeft(liftType<RefreshTripInfoError>()),
        ),
      ),
    ),
)

createIntegrationEventHandler<UserInputReceived, void, never>(
  /* on */ UserInputReceived,
  "DebouncePendingCloudSync",
  ({ trainTripPublisher }) =>
    compose(
      TE.chain(({ trainTripId }) => async () =>
        E.right(await trainTripPublisher.registerIfPending(trainTripId)),
      ),
    ),
)

// const createIntegrationCommandEventHandler = createIntegrationEventHandlerWithDeps({ db: DbContextKey, ...defaultDependencies })
const createIntegrationCommandEventHandler = createIntegrationEventHandlerWithDeps({
  request: requestKey,
  ...defaultDependencies,
})

createIntegrationCommandEventHandler<CustomerRequestedChanges, void, DbError>(
  /* on */ CustomerRequestedChanges,
  "LockTrainTrip",
  curryRequest(lockTrainTrip),
)

export interface TrainTripPublisher {
  registerIfPending(trainTripId: TrainTripId): Promise<void>
  register(trainTripId: TrainTripId): Promise<void>
}

type RefreshTripInfoError = DbError | ApiError | InvalidStateError
