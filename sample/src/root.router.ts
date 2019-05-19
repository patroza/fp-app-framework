import { getHandlerType } from 'fp-app-framework/infrastructure/namespace'
import KoaRouter from 'koa-router'
import { createRouterFromMap, writeRouterSchema } from './koa'
import createTrainTripRouter from './TrainTrip.router'

const createRootRouter = (getHandler: getHandlerType) => {
  const routerMap = new Map<string, [KoaRouter, any[][]]>()
  // Cannot re-use a router :/
  routerMap.set('/train-trip', createTrainTripRouter(getHandler, false))
  // Just for testing auth.
  routerMap.set('/train-trip-auth', createTrainTripRouter(getHandler, true))

  writeRouterSchema(routerMap)
  const rootRouter = createRouterFromMap(routerMap)
  return rootRouter
}

export default createRootRouter
