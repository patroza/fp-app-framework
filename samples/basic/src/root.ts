import { createDependencyNamespace, Key, UnitOfWork, UOWKey } from "@fp-app/framework"
import { exists, mkdir } from "@fp-app/io.diskdb"
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
  )

  container.registerScopedO2(DbContextKey, DiskDBContext)
  container.registerScopedO(UOWKey, () => container.getO(DbContextKey as any as Key<UnitOfWork>))

  container.registerSingletonO2(TrainTripPublisherKey, TrainTripPublisherInMemory)
  container.registerSingletonO2(trainTripReadContextKey, TrainTripReadContext)
  container.registerSingletonF(sendCloudSyncKey, () => sendCloudSyncFake({ cloudUrl: "" }))
  container.registerSingletonF(
    getTripKey,
    () => {
      const { getTrip: getTripF } = createInventoryClient({ templateApiUrl: "http://localhost:8110" })
      return getTripF
    },
  )

  return {
    bindLogger,
    initialize,
    setupRootContext,

    request,
  }
}

const initialize = async () => {
  if (!await exists("./data")) { await mkdir("./data") }
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
