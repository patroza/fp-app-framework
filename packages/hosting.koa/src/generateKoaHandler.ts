import Koa from "koa"

import {
  CombinedValidationError,
  ConnectionError,
  CouldNotAquireDbLockError,
  DbError,
  defaultErrorPassthrough,
  ErrorBase,
  ErrorHandlerType,
  FieldValidationError,
  ForbiddenError,
  InvalidStateError,
  logger,
  NamedHandlerWithDependencies,
  OptimisticLockError,
  RecordNotFound,
  requestType,
  ValidationError,
} from "@fp-app/framework"
import { Result, compose, TE, E } from "@fp-app/fp-ts-extensions"
import { fold } from "fp-ts/lib/Either"

export default function generateKoaHandler<I, T, E extends ErrorBase, E2 extends ValidationError>(
  request: requestType,
  handler: NamedHandlerWithDependencies<any, I, T, E>,
  validate: (i: I) => Result<I, E2>,
  handleErrorOrPassthrough: ErrorHandlerType<Koa.Context, DbError | E | E2> = defaultErrorPassthrough,
  responseTransform?: <TOutput>(input: T, ctx: Koa.Context) => TOutput,
) {
  return async (ctx: Koa.Context) => {
    try {
      const input = { ...ctx.request.body, ...ctx.request.query, ...ctx.params } // query, headers etc

      // DbError, because request handler is enhanced with it (decorator)
      // E2 because the validator enhances it.
      // DbError | E |
      const validated = compose(
        E.right<DbError | E | E2, any>(input),
        E.chain(validate),
      )
      const result = await compose(
        TE.fromEither(validated),
        TE.chain(validatedInput => request(handler, validatedInput)),
      )()
      compose(
        result,
        fold(
          err => (handleErrorOrPassthrough(ctx)(err) ? handleDefaultError(ctx)(err) : undefined),

          output => {
            if (responseTransform) {
              ctx.body = responseTransform(output, ctx)
            } else {
              ctx.body = output
            }
            if (ctx.method === "POST" && output) {
              ctx.status = 201
            }
          },
        ),
      )
    } catch (err) {
      logger.error(err)
      ctx.status = 500
    }
  }
}

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
      fields: {
        [err.fieldName]: err.error instanceof CombinedValidationError ? combineErrors(err.error.errors) : err.message,
      },
      message,
    }
    ctx.status = 400
  } else if (err instanceof ValidationError) {
    ctx.body = { message }
    ctx.status = 400
  } else if (err instanceof InvalidStateError) {
    ctx.body = { message }
    ctx.status = 422
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

const combineErrors = (ers: any[]) =>
  ers.reduce((prev: any, cur) => {
    if (cur instanceof FieldValidationError) {
      if (cur.error instanceof CombinedValidationError) {
        prev[cur.fieldName] = combineErrors(cur.error.errors)
      } else {
        prev[cur.fieldName] = cur.message
      }
    }
    return prev
  }, {})
