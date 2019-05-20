import { UnitOfWork } from 'fp-app-framework/infrastructure/context.base'
import DomainEventHandler, { executePostCommitHandlersKey, publishEventsKey } from 'fp-app-framework/infrastructure/domainEventHandler'
import executePostCommitHandlers from 'fp-app-framework/infrastructure/executePostCommitHandlers'
import { createDependencyNamespace } from 'fp-app-framework/infrastructure/namespace'
import publishEvents from 'fp-app-framework/infrastructure/publishEvents'
import { getRegisteredEventHandlers } from 'fp-app-framework/infrastructure/requestHandlers'
import './TrainTrip/eventhandlers' // To be ble to auto register them :/
import { getPricingFake, getTemplateFake, getTrip, sendCloudSyncFake } from './TrainTrip/infrastructure/api'
import DiskDBContext from './TrainTrip/infrastructure/TrainTripContext.disk'
import TrainTripPublisherInMemory from './TrainTrip/infrastructure/trainTripPublisher.inMemory'
import { DbContextKey, getTripKey, RequestContextKey, sendCloudSyncKey, TrainTripPublisherKey } from './TrainTrip/usecases/types'

const createRoot = () => {
  const {
    bindLogger,
    container,
    setupRootContext,
    setupChildContext,

    request,
    publish,
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
    () => publishEvents(new Map(getRegisteredEventHandlers()), publish),
  )
  container.registerSingletonC(
    DomainEventHandler,
    () => new DomainEventHandler(container.getF(publishEventsKey), container.getF(executePostCommitHandlersKey)),
  )
  container.registerSingletonF(TrainTripPublisherKey, () => new TrainTripPublisherInMemory(request))

  return {
    bindLogger,
    setupRootContext,

    publish,
    request,
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
