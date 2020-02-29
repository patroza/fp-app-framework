import fs from "fs"
import { ErrorBase } from "../errors"
import { ValidatorType } from "../utils/validation"
import { DbError } from "./errors"
import { NamedHandlerWithDependencies, requestType } from "./mediator"

export default abstract class RouteBuilder<TContext> {
  private static register = <TContext>(
    method: METHODS,
    obj: RouteBuilder<TContext>,
  ) => <TDependencies, TInput, TOutput, TError, TValidationError>(
    path: string,
    requestHandler: NamedHandlerWithDependencies<
      TDependencies,
      TInput,
      TOutput,
      TError
    >,
    configuration: {
      errorHandler?: ErrorHandlerType<TContext, DbError | TError | TValidationError>
      responseTransform?: ResponseTransform<TContext, TOutput>
      validator: ValidatorType<TInput, TValidationError>
    },
  ) => {
    obj.setup.push({ method, path, requestHandler, ...configuration })
    return obj
  }

  readonly post = RouteBuilder.register<TContext>("POST", this)
  readonly get = RouteBuilder.register<TContext>("GET", this)
  readonly delete = RouteBuilder.register<TContext>("DELETE", this)
  readonly patch = RouteBuilder.register<TContext>("PATCH", this)

  protected userPass?: string
  protected setup: RegisteredRoute<TContext>[] = []
  protected basicAuthEnabled = false

  abstract build(request: requestType): any

  getJsonSchema() {
    return this.setup.map(
      ({ method, path, validator }) => [method, path, validator.jsonSchema] as const,
    )
  }

  enableBasicAuth(userPass: string) {
    this.basicAuthEnabled = true
    this.userPass = userPass
    return this
  }
}

export interface HALConfig {
  [key: string]: string
}

export type ResponseTransform<TContext, TOutput> = (
  output: TOutput,
  ctx: TContext,
) => any

export function writeRouterSchema(routerMap: Map<string, RouteBuilder<any>>) {
  const schema = [...routerMap.entries()].reduce((prev, [path, r]) => {
    prev[path] = r.getJsonSchema().map(([method, p, s2]) => ({
      method,
      subPath: p,
      fullPath: `${path}${p}`,
      schema: s2,
    }))
    return prev
  }, {} as any)
  fs.writeFileSync("./router-schema.json", JSON.stringify(schema, undefined, 2))
}

export type ErrorHandlerType<TContext, TError> = <TErr extends ErrorBase>(
  ctx: TContext,
) => (err: TError) => TErr | TError | void

export const defaultErrorPassthrough = () => (err: any) => err

interface RegisteredRoute<TContext> {
  method: METHODS
  path: string
  requestHandler: NamedHandlerWithDependencies<any, any, any, any>
  validator: ValidatorType<any, any>
  errorHandler?: ErrorHandlerType<TContext, DbError | any>
  responseTransform?: ResponseTransform<TContext, any>
}

type METHODS = "POST" | "GET" | "DELETE" | "PATCH"
