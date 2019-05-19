import { handleAuthenticationFailedMiddleware, logRequestTime, saveStartTime, setupNamespace } from 'fp-app-framework/infrastructure/koa'
import { logger, setLogger } from 'fp-app-framework/utils'
import fs from 'fs'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import KoaRouter from 'koa-router'
import createRoot from './root'
import createTrainTripRouter from './TrainTrip.router'

const startServer = () => {
  const { bindLogger, setupRootContext, getHandler } = createRoot()

  setLogger(({
    // tslint:disable-next-line:no-console
    debug: bindLogger(console.debug),
    // tslint:disable-next-line:no-console
    error: bindLogger(console.error),
    // tslint:disable-next-line:no-console
    log: bindLogger(console.log),
    // tslint:disable-next-line:no-console
    warn: bindLogger(console.warn),
  }))

  const routerMap = new Map<string, [KoaRouter, any[][]]>()

  // Cannot re-use a router :/
  routerMap.set('/train-trip', createTrainTripRouter(getHandler, false))
  routerMap.set('/train-trip-auth', createTrainTripRouter(getHandler, true))

  const rootRouter = [...routerMap.entries()].reduce((prev, cur) => prev.use(cur[0], cur[1][0].allowedMethods(), cur[1][0].routes()), new KoaRouter())

  const schema = [...routerMap.entries()].reduce((prev, [path, [_, s]]) => {
    prev[path] = s.map(([method, p, s2]) => ({ method, subPath: p, fullPath: `${path}${p}`, schema: s2 }))
    return prev
  }, {} as any)

  fs.writeFileSync('./router-schema.json', JSON.stringify(schema, undefined, 2))

  const app = new Koa()
    .use(saveStartTime)
    .use(setupNamespace({ setupRootContext }))
    .use(logRequestTime)
    .use(bodyParser())
    .use(handleAuthenticationFailedMiddleware)
    .use(rootRouter.allowedMethods())
    .use(rootRouter.routes())

  app.listen(3535, () => logger.log('server listening on 3535'))
}

startServer()
