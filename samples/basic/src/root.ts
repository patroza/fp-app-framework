import { Key, UnitOfWork } from "@fp-app/framework"
import { createDependencyNamespace } from "@fp-app/framework"
import { exists, mkdir } from "../../../packages/io.diskdb/src/utils"
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
    DbContextKey as any as Key<UnitOfWork>,
  )

  container.registerScopedO(DbContextKey, () => container.createNewInstance(DiskDBContext))

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

  // TODO: this needs to become automated, or simplified to register both key and class
  // the key can be used for functions, the class for other classes, although they can also support keys
  // so perhaps better to just generate keys for all, except that classes can be auto-injected based on
  // decorator metadata so... (perhaps that can be done with functions at some point too - somehow?)
  container.registerSingletonC(TrainTripReadContext, () => container.getO(trainTripReadContextKey))

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
