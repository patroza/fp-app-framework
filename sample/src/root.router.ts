import { getRequestHandlerType } from 'fp-app-framework/infrastructure/requestHandlers'
import RouteBuilder, { createRouterFromMap, writeRouterSchema } from 'fp-app-framework/infrastructure/RouteBuilder'
import { DEFAULT_AUTH } from './config'
import createTrainTripRouter from './TrainTrip.router'

const createRootRouter = (getRequestHandler: getRequestHandlerType) => {
  const routerMap = new Map<string, RouteBuilder>()
  routerMap.set('/train-trip', createTrainTripRouter())
  routerMap.set('/train-trip-auth', createTrainTripRouter().enableBasicAuth(DEFAULT_AUTH))
  writeRouterSchema(routerMap)

  const rootRouter = createRouterFromMap(routerMap, getRequestHandler)
  return rootRouter
}

export default createRootRouter
