import { UnitOfWork } from 'fp-app-framework/src/infrastructure/context.base'
import DomainEventHandler, { executePostCommitHandlersKey, publishEventsKey } from 'fp-app-framework/src/infrastructure/domainEventHandler'
import executePostCommitHandlers from 'fp-app-framework/src/infrastructure/executePostCommitHandlers'
import { createDependencyNamespace } from 'fp-app-framework/src/infrastructure/namespace'
import publishEvents from 'fp-app-framework/src/infrastructure/publishEvents'
import { getRegisteredEvents } from 'fp-app-framework/src/infrastructure/requestHandlers'
import './TrainTrip/eventhandlers' // To be ble to auto register them :/
import { getPricingFake, getTemplateFake, getTrip, sendCloudSyncFake } from './TrainTrip/infrastructure/api'
import DiskDBContext from './TrainTrip/infrastructure/TrainTripContext.disk'
import TrainTripPublisherInMemory from './TrainTrip/infrastructure/trainTripPublisher.inMemory'
import { DbContextKey, getTripKey, RequestContextKey, sendCloudSyncKey, TrainTripPublisherKey } from './TrainTrip/usecases/types'

const createRoot = () => {
  const {
    bindLogger,
    container,
    getHandler,
    setupRootContext,
    setupChildContext,
  } = createDependencyNamespace(
    namespace,
    RequestContextKey,
    DbContextKey as any as UnitOfWork,
  )

  container.registerScopedF(DbContextKey, () => new DiskDBContext(container.getC(DomainEventHandler)))

  container.registerSingletonF(sendCloudSyncKey, () => sendCloudSyncFake({ cloudUrl: '' }))
  container.registerSingletonF(
    getTripKey,
    () => {
      const { getTrip: getTripF } = createInventoryClient({ templateApiUrl: 'http://localhost:8110' })
      return getTripF
    },
  )
  container.registerSingletonF(executePostCommitHandlersKey, () => executePostCommitHandlers({ setupChildContext }))
  container.registerSingletonF(
    publishEventsKey,
    () => publishEvents(new Map(getRegisteredEvents()), hndlr => container.getF(hndlr[1])),
  )
  container.registerSingletonC(
    DomainEventHandler,
    () => new DomainEventHandler(container.getF(publishEventsKey), container.getF(executePostCommitHandlersKey)),
  )
  container.registerSingletonF(TrainTripPublisherKey, () => new TrainTripPublisherInMemory(getHandler))

  return {
    bindLogger,
    getHandler,
    setupRootContext,
  }
}

const namespace = 'fw-trainTrip-service'

export default createRoot

const createInventoryClient = ({ templateApiUrl }: { templateApiUrl: string }) => {
  const getTemplate = getTemplateFake({ templateApiUrl })
  return {
    getPricing: getPricingFake({ getTemplate, pricingApiUrl: templateApiUrl }),
    getTemplate,
    getTrip: getTrip({ getTemplate }),
  }
}
