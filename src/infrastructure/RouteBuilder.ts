import { ErrorBase } from 'fp-app-framework/errors'
import fs from 'fs'
import assert from '../utils/assert'
import { ValidatorType } from '../utils/validation'
import { DbError } from './errors'
import { requestType, UsecaseWithDependencies } from './requestHandlers'

export default abstract class RouteBuilder<TContext> {
  private static register = <TContext>(method: METHODS, obj: RouteBuilder<TContext>) => <TDependencies, TInput, TOutput, TError, TValidationError>(
    path: string, requestHandler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
    validator: ValidatorType<TInput, TValidationError>,
    errorHandler?: ErrorHandlerType<TContext, DbError | TError | TValidationError>,
  ) => {
    obj.setup.push({ method, path, requestHandler, validator, errorHandler })
    return obj
  }

  readonly post = RouteBuilder.register<TContext>('POST', this)
  readonly get = RouteBuilder.register<TContext>('GET', this)
  readonly delete = RouteBuilder.register<TContext>('DELETE', this)
  readonly patch = RouteBuilder.register<TContext>('PATCH', this)

  protected userPass?: string
  protected setup: Array<RegisteredRoute<TContext>> = []
  protected basicAuthEnabled: boolean = false

  abstract build(request: requestType): any

  getJsonSchema() {
    return this.setup.map(({ method, path, validator }) =>
      [method, path, validator.jsonSchema] as const,
    )
  }

  enableBasicAuth(userPass: string) {
    assert.isNotNull({ userPass })

    this.basicAuthEnabled = true
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

export type ErrorHandlerType<TContext, TError> = <TErr extends ErrorBase>(ctx: TContext) => (err: TError) => TErr | TError | void

export const defaultErrorPassthrough = () => (err: any) => err

interface RegisteredRoute<TContext> {
  method: METHODS,
  path: string,
  requestHandler: UsecaseWithDependencies<any, any, any, any>,
  validator: ValidatorType<any, any>,
  errorHandler?: ErrorHandlerType<TContext, DbError | any>,
}

type METHODS = 'POST' | 'GET' | 'DELETE' | 'PATCH'
