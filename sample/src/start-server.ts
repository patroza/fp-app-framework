import { logRequestTime, saveStartTime, setupNamespace } from 'fp-app-framework/src/infrastructure/koa'
import { logger, setLogger } from 'fp-app-framework/src/utils'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import KoaRouter from 'koa-router'
import createITPRouter from './feature.router'
import createRoot from './root'

const startServer = () => {
  const { bindLogger, setDependencyScope, ns, usecases } = createRoot()

  setLogger(({
    // tslint:disable-next-line:no-console
    error: bindLogger(console.error),
    // tslint:disable-next-line:no-console
    log: bindLogger(console.log),
    // tslint:disable-next-line:no-console
    warn: bindLogger(console.warn),
  }))

  const itpRouter = createITPRouter(usecases.feature)
  const rootRouter = new KoaRouter()
    .use('/itp', itpRouter.allowedMethods(), itpRouter.routes())

  const app = new Koa()
    .use(saveStartTime)
    .use(setupNamespace({ setDependencyScope, ns }))
    .use(logRequestTime)
    .use(bodyParser())
    .use(rootRouter.allowedMethods())
    .use(rootRouter.routes())

  app.listen(3535, () => logger.log('server listening on 3535'))
}

startServer()
