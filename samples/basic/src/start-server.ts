import { logger, setLogger } from "@fp-app/framework"
import { handleAuthenticationFailedMiddleware, logRequestTime, saveStartTime, setupNamespace } from "@fp-app/hosting.koa"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import { PORT } from "./config"
import createRoot from "./root"
import createRootRouter from "./root.router"

const startServer = () => {
  const { bindLogger, setupRootContext, request } = createRoot()

  const rootRouter = createRootRouter(request)

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

  const app = new Koa()
    .use(saveStartTime)
    .use(setupNamespace({ setupRootContext }))
    .use(logRequestTime)
    .use(bodyParser())
    .use(handleAuthenticationFailedMiddleware)
    .use(rootRouter.allowedMethods())
    .use(rootRouter.routes())

  app.listen(PORT, () => logger.log("server listening on 3535"))
}

startServer()
