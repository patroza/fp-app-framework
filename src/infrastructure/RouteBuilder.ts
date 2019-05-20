import fs from 'fs'
import Koa from 'koa'
import KoaRouter from 'koa-router'
import { ErrorBase } from '../errors'
import { authMiddleware as authMiddlewareCreator, generateKoaHandler } from '../infrastructure/koa'
import { getHandlerType, UsecaseHandlerTuple } from '../infrastructure/requestHandlers'
import { Writeable } from '../utils'
import assert from '../utils/assert'
import { ValidatorType } from '../utils/validation'

export default class RouteBuilder {
  private get w() { return this as Writeable<RouteBuilder> }

  private static register = (method: METHODS, obj: RouteBuilder) => <TDependencies, TInput, TOutput, TError, TValidationError>(
    path: string, handler: UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError>,
    validator: ValidatorType<TInput, TValidationError>,
    // TODO: Error Handler is Koa specific :)
    errorHandler?: <TErr extends ErrorBase>(ctx: Koa.Context) => (err: TError | TValidationError) => TErr | TError | TValidationError | void,
  ) => {
    obj.setup.push({ method, path, handler, validator, errorHandler })
    return obj
  }

  readonly basicAuthEnabled: boolean = false

  readonly post = RouteBuilder.register('POST', this)
  readonly get = RouteBuilder.register('GET', this)
  readonly delete = RouteBuilder.register('DELETE', this)
  readonly patch = RouteBuilder.register('PATCH', this)

  private userPass?: string
  private setup: RegisteredRoute[] = []

  readonly build = (getHandler: getHandlerType) => {
    const router = new KoaRouter()
    if (this.basicAuthEnabled) {
      if (!this.userPass) { throw new Error('cannot enable auth without loginPass') }
      router.use(authMiddlewareCreator(this.userPass)())
    }

    this.setup.forEach(({ method, path, handler, validator, errorHandler }) => {
      router.register(
        path, [method],
        generateKoaHandler(
          getHandler(handler) as any,
          validator,
          errorHandler,
        ),
      )
    })

    return router
  }

  getJsonSchema() {
    return this.setup.map(({ method, path, validator }) =>
      [method, path, validator.jsonSchema],
    )
  }

  enableBasicAuth(userPass: string) {
    assert.isNotNull({ userPass })

    this.w.basicAuthEnabled = true
    this.userPass = userPass
    return this
  }
}

export function createRouterFromMap(routerMap: Map<string, RouteBuilder>, getHandler: getHandlerType) {
  return [...routerMap.entries()].reduce((prev, cur) => {
    const koaRouter = cur[1].build(getHandler)
    return prev.use(cur[0], koaRouter.allowedMethods(), koaRouter.routes())
  }, new KoaRouter())
}

export function writeRouterSchema(routerMap: Map<string, RouteBuilder>) {
  const schema = [...routerMap.entries()].reduce((prev, [path, r]) => {
    prev[path] = r.getJsonSchema().map(([method, p, s2]) => ({ method, subPath: p, fullPath: `${path}${p}`, schema: s2 }))
    return prev
  }, {} as any)
  fs.writeFileSync('./router-schema.json', JSON.stringify(schema, undefined, 2))
}

interface RegisteredRoute {
  method: METHODS,
  path: string,
  handler: UsecaseHandlerTuple<any, any, any, any>,
  validator: ValidatorType<any, any>,
  errorHandler?: <TErr extends ErrorBase>(ctx: Koa.Context) => (err: any) => TErr | any | void,
}

type METHODS = 'POST' | 'GET' | 'DELETE' | 'PATCH'
