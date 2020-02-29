import { calculateElapsed, logger, RequestContextBase } from "@fp-app/framework"
import chalk from "chalk"
import { EventEmitter } from "events"
import Koa from "koa"
import auth from "koa-basic-auth"
import onFinished from "on-finished"

export const saveStartTime: Koa.Middleware = (ctx, next) => {
  ctx["start-time"] = process.hrtime()
  return next()
}

export const setupNamespace = ({
  setupRequestContext,
}: {
  setupRequestContext: <T>(
    cb: (
      context: RequestContextBase,
      bindEmitter: (emitter: EventEmitter) => void,
    ) => Promise<T>,
  ) => Promise<T>
}): Koa.Middleware => (ctx, next) =>
  setupRequestContext((context, bindEmitter) => {
    bindEmitter(ctx.req)
    bindEmitter(ctx.res)

    const correllationId = ctx.get("X-Request-ID") || context.id
    ctx.set("X-Request-Id", correllationId)
    Object.assign(context, { correllationId })

    return next()
  })

export const logRequestTime: Koa.Middleware = async (ctx, next) => {
  const reqPath = `${ctx.method} ${ctx.path}`
  const reqHeaders = ctx.headers
  logger.log(`${chalk.bold(reqPath)} Start request`, {
    headers: JSON.parse(JSON.stringify(reqHeaders)),
  })

  onFinished(ctx.res, () => {
    const elapsed = calculateElapsed(ctx["start-time"])
    const elapsedFormatted = `${elapsed}ms`
    logger.debug(
      `${chalk.bgWhite.black(elapsedFormatted)} ${chalk.bold(
        reqPath,
      )} Closed HTTP request`,
    )
  })

  await next()

  const headers = ctx.response.headers
  const status = ctx.status
  const elapsed2 = calculateElapsed(ctx["start-time"])
  const elapsedFormatted2 = `${elapsed2}ms`
  logger.log(
    `${chalk.bgWhite.black(elapsedFormatted2)} ${chalk.bold(
      reqPath,
    )} Finished HTTP processing`,
    JSON.parse(JSON.stringify({ status, headers })),
  )
}

export const authMiddleware = (defaultNamePass: string) => (
  namePass: string = defaultNamePass,
) => {
  const [name, pass] = namePass.split(":")
  return auth({ name, pass })
}

export const handleAuthenticationFailedMiddleware: Koa.Middleware = async (
  ctx,
  next,
) => {
  try {
    await next()
  } catch (err) {
    if (401 === err.status) {
      ctx.status = 401
      ctx.set("WWW-Authenticate", "Basic")
      ctx.body = { messsage: "Unauthorized" }
    } else {
      throw err
    }
  }
}
