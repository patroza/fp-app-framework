import chalk from 'chalk'
import { EventEmitter } from 'events'
import Koa from 'koa'
import onFinished from 'on-finished'
import { CombinedValidationError, ErrorBase, FieldValidationError, ForbiddenError, ValidationError } from '../errors'
import { calculateElapsed, logger } from '../utils'
import { flatMap, Result, startWithVal } from '../utils/neverthrow-extensions'
import { CouldNotAquireDbLockError, OptimisticLockError } from './diskdb'
import { ConnectionError, DbError, RecordNotFound } from './errors'
import { RequestContextBase } from './misc'

import auth from 'koa-basic-auth'
import { requestType, UsecaseWithDependencies } from './requestHandlers'

export const generateKoaHandler = <I, T, E extends ErrorBase, E2 extends ValidationError>(
  request: requestType,
  handler: UsecaseWithDependencies<any, I, T, E>,
  validate: (i: I) => Result<I, E2>,
  handleErrorOrPassthrough: <TErr extends ErrorBase>(ctx: Koa.Context) => (err: DbError | E | E2) => TErr | E | E2 | void = defaultErrorPassthrough,
) => async (ctx: Koa.Context) => {
  try {
    const input = { ...ctx.request.body, ...ctx.request.query, ...ctx.params } // query, headers etc

    // DbError, because request handler is enhanced with it (decorator)
    // E2 because the validator enhances it.
    const result = await startWithVal<DbError | E | E2>()(input)
      .pipe(
        flatMap(validate),
        flatMap(validatedInput => request(handler, validatedInput)),
      )
    result.match(t => {
      if (ctx.method === 'POST' && t) {
        ctx.status = 201
        ctx.body = { id: t, self: `${ctx.path}/${t}` }
      } else {
        ctx.body = t
      }
    },
      err => handleErrorOrPassthrough(ctx)(err) ? handleDefaultError(ctx)(err) : undefined,
    )
  } catch (err) {
    logger.error(err)
    ctx.status = 500
  }
}

export const saveStartTime: Koa.Middleware = (ctx, next) => { ctx['start-time'] = process.hrtime(); return next() }

export const setupNamespace = (
  { setupRootContext }: {
    setupRootContext: <T>(
      cb: (context: RequestContextBase, bindEmitter: (emitter: EventEmitter) => void) => Promise<T>,
    ) => Promise<T>,
  }): Koa.Middleware => (ctx, next) => setupRootContext((context, bindEmitter) => {
    bindEmitter(ctx.req)
    bindEmitter(ctx.res)

    const correllationId = ctx.get('X-Request-ID') || context.id
    ctx.set('X-Request-Id', correllationId)
    Object.assign(context, { correllationId })

    return next()
  })

export const logRequestTime: Koa.Middleware = async (ctx, next) => {
  const reqPath = `${ctx.method} ${ctx.path}`
  const reqHeaders = ctx.headers
  logger.log(`${chalk.bold(reqPath)} Start request`, { headers: JSON.parse(JSON.stringify(reqHeaders)) })

  onFinished(ctx.res, () => {
    const elapsed = calculateElapsed(ctx['start-time'])
    const elapsedFormatted = `${elapsed}ms`
    logger.debug(`${chalk.bgWhite.black(elapsedFormatted)} ${chalk.bold(reqPath)} Closed request`)
  })

  await next()

  const headers = ctx.response.headers
  const status = ctx.status
  const elapsed2 = calculateElapsed(ctx['start-time'])
  const elapsedFormatted2 = `${elapsed2}ms`
  logger.log(
    `${chalk.bgWhite.black(elapsedFormatted2)} ${chalk.bold(reqPath)} Finished processing`,
    JSON.parse(JSON.stringify({ status, headers })),
  )
}

const defaultErrorPassthrough = () => (err: any) => err

const handleDefaultError = (ctx: Koa.Context) => (err: ErrorBase) => {
  const { message } = err

  // TODO: Exhaustive condition error so that we remain aware of possible errors
  // but needs to be then Typed somehow
  // const err2 = new ValidationError("some message") as Err
  // switch (err2.name) {
  //   case "FieldValidationError":
  //   case "CombinedValidationError":
  //   case "ValidationError": break
  //   case "ConnectionError": break
  //   case "RecordNotFound": break
  //   // tslint:disable-next-line
  //   default: { const exhaustiveCheck: never = err2; return exhaustiveCheck }
  // }

  if (err instanceof RecordNotFound) {
    ctx.body = { message }
    ctx.status = 404
  } else if (err instanceof CombinedValidationError) {
    const { errors } = err
    ctx.body = {
      fields: combineErrors(errors),
      message,
    }
    ctx.status = 400
  } else if (err instanceof FieldValidationError) {
    ctx.body = {
      fields: { [err.fieldName]: err.error instanceof CombinedValidationError ? combineErrors(err.error.errors) : err.message },
      message,
    }
    ctx.status = 400
  } else if (err instanceof ValidationError) {
    ctx.body = { message }
    ctx.status = 400
  } else if (err instanceof ForbiddenError) {
    ctx.body = { message }
    ctx.status = 403
  } else if (err instanceof OptimisticLockError) {
    ctx.status = 409
  } else if (err instanceof CouldNotAquireDbLockError) {
    ctx.status = 503
  } else if (err instanceof ConnectionError) {
    ctx.status = 504
  } else {
    // Unknown error
    ctx.status = 500
  }
}

export const authMiddleware = (defaultNamePass: string) => (namePass: string = defaultNamePass) => {
  const [name, pass] = namePass.split(':')
  return auth({ name, pass })
}

export const handleAuthenticationFailedMiddleware: Koa.Middleware = async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    if (401 === err.status) {
      ctx.status = 401
      ctx.set('WWW-Authenticate', 'Basic')
      ctx.body = { messsage: 'Unauthorized' }
    } else {
      throw err
    }
  }
}

const combineErrors = (ers: any[]) => ers.reduce((prev: any, cur) => {
  if (cur instanceof FieldValidationError) {
    if (cur.error instanceof CombinedValidationError) {
      prev[cur.fieldName] = combineErrors(cur.error.errors)
    } else {
      prev[cur.fieldName] = cur.message
    }
  }
  return prev
}, {})
