import { RequestContextKey } from '@/ITP/usecases/types'
import { Namespace } from 'cls-hooked'
import Koa from 'koa'
import { Result } from 'neverthrow'
import { CombinedValidationError, ErrorBase, FieldValidationError, ForbiddenError, ValidationError } from '../errors'
import { calculateElapsed, logger } from '../utils'
import { flatMap, PipeFunction, startWithVal } from '../utils/neverthrow-extensions'
import { CouldNotAquireDbLockError, OptimisticLockError } from './diskdb'
import { ConnectionError, RecordNotFound } from './errors'
import SimpleContainer from './SimpleContainer'

export const generateKoaHandler = <I, T, E extends ErrorBase, E2 extends ValidationError>(
  handleRequest: PipeFunction<I, T, E>,
  validate: (i: I) => Result<I, E2>,
  handleErrorOrPassthrough: <TErr extends ErrorBase>(ctx: Koa.Context) => (err: E | E2) => TErr | E | E2 | void = defaultErrorPassthrough,
) => async (ctx: Koa.Context) => {
  try {
    const input = { ...ctx.request.body, ...ctx.request.query, ...ctx.params } // query, headers etc
    const result = await startWithVal<E | E2>()(input)
      .pipe(
        flatMap(validate),
        flatMap(handleRequest),
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
  {container, ns, setupRootContext}: {
    container: SimpleContainer,
    setupRootContext: <T>(cb: () => Promise<T>) => Promise<T>,
    ns: Namespace,
}): Koa.Middleware => (ctx, next) => setupRootContext(() => {
  ns.bindEmitter(ctx.req)
  ns.bindEmitter(ctx.res)

  const context = container.getF(RequestContextKey)
  const correllationId = ctx.get('X-Request-ID') || context.id
  ctx.set('X-Request-Id', correllationId)
  Object.assign(context, { correllationId })

  return next()
})

export const logRequestTime: Koa.Middleware = async (ctx, next) =>  {
  logger.log(`$$ ${ctx.method} ${ctx.path} Start request`)
  await next()
  const contentLength = ctx.response.get('Content-Length')
  const status = ctx.status
  const type = ctx.response.get('Content-Type')
  const elapsed = calculateElapsed(ctx['start-time'])
  logger.log(`$$ ${elapsed}ms ${ctx.method} ${ctx.path} End request`, { contentLength, status, type })
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
