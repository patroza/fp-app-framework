import fs from 'fs'
import { ErrorHandlerType } from '../infrastructure/koa'
import { requestType, UsecaseWithDependencies } from '../infrastructure/requestHandlers'
import { Writeable } from '../utils'
import assert from '../utils/assert'
import { ValidatorType } from '../utils/validation'
import { DbError } from './errors'

export default abstract class RouteBuilder<TContext> {
  private get w() { return this as Writeable<RouteBuilder<TContext>> }

  private static register = <TContext>(method: METHODS, obj: RouteBuilder<TContext>) => <TDependencies, TInput, TOutput, TError, TValidationError>(
    path: string, requestHandler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
    validator: ValidatorType<TInput, TValidationError>,
    errorHandler?: ErrorHandlerType<TContext, DbError | TError | TValidationError>,
  ) => {
    obj.setup.push({ method, path, requestHandler, validator, errorHandler })
    return obj
  }

  readonly basicAuthEnabled: boolean = false

  readonly post = RouteBuilder.register<TContext>('POST', this)
  readonly get = RouteBuilder.register<TContext>('GET', this)
  readonly delete = RouteBuilder.register<TContext>('DELETE', this)
  readonly patch = RouteBuilder.register<TContext>('PATCH', this)

  protected userPass?: string
  protected setup: Array<RegisteredRoute<TContext>> = []

  abstract build(request: requestType): any

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

export function writeRouterSchema(routerMap: Map<string, RouteBuilder<any>>) {
  const schema = [...routerMap.entries()].reduce((prev, [path, r]) => {
    prev[path] = r.getJsonSchema().map(([method, p, s2]) => ({ method, subPath: p, fullPath: `${path}${p}`, schema: s2 }))
    return prev
  }, {} as any)
  fs.writeFileSync('./router-schema.json', JSON.stringify(schema, undefined, 2))
}

interface RegisteredRoute<TContext> {
  method: METHODS,
  path: string,
  requestHandler: UsecaseWithDependencies<any, any, any, any>,
  validator: ValidatorType<any, any>,
  errorHandler?: ErrorHandlerType<TContext, DbError | any>,
}

type METHODS = 'POST' | 'GET' | 'DELETE' | 'PATCH'
