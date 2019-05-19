import { logRequestTime, saveStartTime, setupNamespace } from 'fp-app-framework/infrastructure/koa'
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

  const [trainTripRouter, trainTripSchema] = createTrainTripRouter(getHandler)
  const rootRouter = new KoaRouter()
    .use('/train-trip', trainTripRouter.allowedMethods(), trainTripRouter.routes())

  const schema = trainTripSchema.map(x => [x[0], `/train-trip${x[1]}`, x[2]])
  fs.writeFileSync('./router-schema.json', JSON.stringify(schema, undefined, 2))

  const app = new Koa()
    .use(saveStartTime)
    .use(setupNamespace({ setupRootContext }))
    .use(logRequestTime)
    .use(bodyParser())
    .use(rootRouter.allowedMethods())
    .use(rootRouter.routes())

  app.listen(3535, () => logger.log('server listening on 3535'))
}

startServer()
