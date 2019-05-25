import { createDependencyNamespace, Key, UnitOfWork, UOWKey } from "@fp-app/framework"
import { exists, mkdir } from "@fp-app/io.diskdb"
import "./TrainTrip/eventhandlers" // To be ble to auto register them :/
import { getPricingFake, getTemplateFake, getTrip, sendCloudSyncFake } from "./TrainTrip/infrastructure/api"
import DiskDBContext from "./TrainTrip/infrastructure/TrainTripContext.disk"
import TrainTripPublisherInMemory from "./TrainTrip/infrastructure/trainTripPublisher.inMemory"
import TrainTripReadContext, { trainTripReadContextKey } from "./TrainTrip/infrastructure/TrainTripReadContext.disk"
import { DbContextKey, getTripKey, RequestContextKey, sendCloudSyncKey, TrainTripPublisherKey } from "./TrainTrip/usecases/types"

import chalk from "chalk"

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

  container.registerScopedC2(DbContextKey, DiskDBContext)
  container.registerPassthrough(UOWKey, DbContextKey as any as Key<UnitOfWork>)

  container.registerSingletonC2(TrainTripPublisherKey, TrainTripPublisherInMemory)
  container.registerSingletonC2(trainTripReadContextKey, TrainTripReadContext)
  container.registerSingletonF(sendCloudSyncKey, () => sendCloudSyncFake({ cloudUrl: "" }))
  container.registerSingletonF(
    getTripKey,
    () => {
      const { getTrip: getTripF } = createInventoryClient({ templateApiUrl: "http://localhost:8110" })
      return getTripF
    },
  )

  // tslint:disable-next-line:no-console
  container.registerInitializerF("global", (i, key) => console.debug(chalk.magenta(`Created function of ${key.name} (${i.name})`)))
  // tslint:disable-next-line:no-console
  container.registerInitializerC<any>("global", (i, key) => console.debug(chalk.magenta(`Created instance of ${key.name} (${i.constructor.name})`)))
  // tslint:disable-next-line:no-console
  container.registerInitializerO<any>("global", (i, key) => console.debug(chalk.magenta(`Created object of ${key.name} (${i.constructor.name})`)))

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
