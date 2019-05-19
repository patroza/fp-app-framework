import { getHandlerType } from 'fp-app-framework/infrastructure/namespace'
import RouteBuilder, { createRouterFromMap, writeRouterSchema } from 'fp-app-framework/infrastructure/RouteBuilder'
import { DEFAULT_AUTH } from './config'
import createTrainTripRouter from './TrainTrip.router'

const createRootRouter = (getHandler: getHandlerType) => {
  const routerMap = new Map<string, RouteBuilder>()
  routerMap.set('/train-trip', createTrainTripRouter())
  routerMap.set('/train-trip-auth', createTrainTripRouter().enableBasicAuth(DEFAULT_AUTH))
  writeRouterSchema(routerMap)

  const rootRouter = createRouterFromMap(routerMap, getHandler)
  return rootRouter
}

export default createRootRouter
