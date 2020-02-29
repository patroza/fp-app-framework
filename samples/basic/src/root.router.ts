import { requestType, writeRouterSchema } from "@fp-app/framework"
import { createRouterFromMap, KoaRouteBuilder } from "@fp-app/hosting.koa"
import { DEFAULT_AUTH } from "./config"
import createTrainTripRouter from "./TrainTrip.router"

const createRootRouter = (request: requestType) => {
  const routerMap = new Map<string, KoaRouteBuilder>()
  routerMap.set("/train-trip", createTrainTripRouter())
  routerMap.set(
    "/train-trip-auth",
    createTrainTripRouter().enableBasicAuth(DEFAULT_AUTH),
  )
  writeRouterSchema(routerMap)

  const rootRouter = createRouterFromMap(routerMap, request)
  return rootRouter
}

export default createRootRouter
