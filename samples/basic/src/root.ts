import { UnitOfWork } from "@fp-app/framework"
import { createDependencyNamespace, DomainEventHandler } from "@fp-app/framework"
import "./TrainTrip/eventhandlers" // To be ble to auto register them :/
import { getPricingFake, getTemplateFake, getTrip, sendCloudSyncFake } from "./TrainTrip/infrastructure/api"
import DiskDBContext from "./TrainTrip/infrastructure/TrainTripContext.disk"
import TrainTripPublisherInMemory from "./TrainTrip/infrastructure/trainTripPublisher.inMemory"
import TrainTripReadContext, { trainTripReadContextKey } from "./TrainTrip/infrastructure/TrainTripReadContext.disk"
import { DbContextKey, getTripKey, RequestContextKey, sendCloudSyncKey, TrainTripPublisherKey } from "./TrainTrip/usecases/types"

const createRoot = () => {
  const {
    bindLogger,
    container,
    setupRootContext,

    request,
  } = createDependencyNamespace(
    namespace,
    RequestContextKey,
    DbContextKey as any as UnitOfWork,
  )

  container.registerScopedO(DbContextKey, () => new DiskDBContext(container.getC(DomainEventHandler)))

  container.registerSingletonF(sendCloudSyncKey, () => sendCloudSyncFake({ cloudUrl: "" }))
  container.registerSingletonF(
    getTripKey,
    () => {
      const { getTrip: getTripF } = createInventoryClient({ templateApiUrl: "http://localhost:8110" })
      return getTripF
    },
  )
  container.registerSingletonO(TrainTripPublisherKey, () => new TrainTripPublisherInMemory(request))
  container.registerSingletonO(trainTripReadContextKey, () => new TrainTripReadContext())

  return {
    bindLogger,
    setupRootContext,

    request,
  }
}

const namespace = "train-trip-service"

export default createRoot

const createInventoryClient = ({ templateApiUrl }: { templateApiUrl: string }) => {
  const getTemplate = getTemplateFake({ templateApiUrl })
  return {
    getPricing: getPricingFake({ getTemplate, pricingApiUrl: templateApiUrl }),
    getTemplate,
    getTrip: getTrip({ getTemplate }),
  }
}
