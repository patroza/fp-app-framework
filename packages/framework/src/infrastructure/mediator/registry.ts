import { PipeFunction, AsyncResult } from "@fp-app/fp-ts-extensions"
import chalk from "chalk"
import Event from "../../event"
import { Constructor, getLogger, setFunctionName, typedKeysOf } from "../../utils"
import assert from "../../utils/assert"
import { UnitOfWork } from "../context.base"
import { registerDomainEventHandler, registerIntegrationEventHandler } from "../createDependencyNamespace"
import {
  generateKey,
  InjectedDependencies,
  injectSymbol,
  requestTypeSymbol,
  WithDependencies,
  WithDependenciesConfig,
} from "../SimpleContainer"

const logger = getLogger("registry")

export interface RequestContextBase {
  id: string
  correllationId: string
}

export type EventHandlerWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<
  TDependencies,
  TInput,
  TOutput,
  TError
>
export type UsecaseWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<
  TDependencies,
  TInput,
  TOutput,
  TError
>

export const configureDependencies = <TDependencies, T>(
  deps: TDependencies,
  name: string,
  f: WithDependencies<TDependencies, T>,
): WithDependenciesConfig<TDependencies, T> => {
  const keys = typedKeysOf(deps)
  if (keys.length && keys.some(key => !deps[key])) {
    throw new Error(`Has empty dependencies`)
  }
  setFunctionName(f, name)
  const anyF: any = f
  anyF[injectSymbol] = deps
  return anyF
}

export const UOWKey = generateKey<UnitOfWork>("unit-of-work")

export type resolveEventType = (evt: { type: any; payload: any }) => Event | undefined
export const resolveEventKey = generateKey<resolveEventType>("resolveEvent")

type HandlerWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<
  TDependencies,
  PipeFunction<TInput, TOutput, TError>
>

// tslint:disable-next-line:max-line-length
export type NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<
  TDependencies,
  NamedRequestHandler<TInput, TOutput, TError>
> &
  HandlerInfo<TDependencies>

interface HandlerTypeInfo {
  [requestTypeSymbol]: HandlerType
}
type HandlerInfo<TDependencies> = InjectedDependencies<TDependencies> & HandlerTypeInfo
type HandlerType = "COMMAND" | "QUERY" | "DOMAINEVENT" | "INTEGRATIONEVENT"

// tslint:disable-next-line:max-line-length
// type HandlerTuple<TDependencies, TInput, TOutput, TError> = readonly [
//   NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TError>,
//   TDependencies,
//   { name: string, type: HandlerType }
// ]

const registerUsecaseHandler = <TDependencies>(deps: TDependencies) => (name: string, type: HandlerType) => <
  TInput,
  TOutput,
  TError
>(
  handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
) => {
  assert(!typedKeysOf(deps).some(x => !deps[x]), "Dependencies must not be null")

  const newHandler = handler as NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TError>
  newHandler[requestTypeSymbol] = type
  newHandler[injectSymbol] = deps
  setFunctionName(handler, name)

  // const r = [newHandler, deps, { name, type }] as const
  // dependencyMap.set(handler, r)
  requestAndEventHandlers.push(newHandler)
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createCommandWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(
  name: string,
  handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>,
) => {
  handler = wrapHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(name + "Command", "COMMAND")(handler)
  logger.debug(chalk.magenta(`Created Command handler ${name}`))
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createQueryWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(
  name: string,
  handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>,
) => {
  handler = wrapHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(name + "Query", "QUERY")(handler)
  logger.debug(chalk.magenta(`Created Query handler ${name}`))
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createDomainEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(
  event: Constructor<TInput>,
  name: string,
  handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>,
) => {
  handler = wrapHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(`on${event.name}${name}`, "DOMAINEVENT")(handler)
  registerDomainEventHandler(event, handler)
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createIntegrationEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(
  event: Constructor<TInput>,
  name: string,
  handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>,
) => {
  handler = wrapHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(`on${event.name}${name}`, "INTEGRATIONEVENT")(handler)
  registerIntegrationEventHandler(event, handler)
  return newHandler
}

const wrapHandler = (handler: any) => (...args: any[]) => handler(...args)

const requestAndEventHandlers: NamedHandlerWithDependencies<any, any, any, any>[] = []

const getRegisteredRequestAndEventHandlers = () => [...requestAndEventHandlers]

const curryRequest = <TDependencies, TInput, TOutput, TErr>(
  req: NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TErr>,
) => ({ request }: { request: requestType }) => (input: TInput) => request(req, input)

export {
  getRegisteredRequestAndEventHandlers,
  createCommandWithDeps,
  createDomainEventHandlerWithDeps,
  createIntegrationEventHandlerWithDeps,
  createQueryWithDeps,
  curryRequest,
}

export type requestType = <TInput, TOutput, TError>(
  requestHandler: NamedHandlerWithDependencies<any, TInput, TOutput, TError>,
  input: TInput,
) => AsyncResult<TOutput, TError>

export type requestInNewScopeType = requestType

export type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr> & HandlerInfo<any>

export const requestKey = generateKey<requestType>("request")
export const requestInNewScopeKey = generateKey<requestInNewScopeType>("requestInNewScope")

// const dependencyMap = new Map<HandlerWithDependencies<any, any, any, any>, HandlerTuple<any, any, any, any>>()

// Allow requesting a class directly, instead of requiring a key
// However one should depend on abstract base classes (don't satisfy the contraint)
// or interfaces / function signatures (requires key)
// export const asDep = <T extends (new (...args: any[]) => any)>(t: T) => t as any as InstanceType<typeof t>

// const generateConfiguredHandler = <TInput, TOutput, TErr>(
//   // Have to specify name as we don't use classes to retrieve the name from
//   name: string,
//   createHandler: () => PipeFunction<TInput, TOutput, TErr>,
//   decoratorFactories: Array<() => RequestHandlerDecorator>,
//   isCommand = false,
// ): NamedRequestHandler<TInput, TOutput, TErr> => {
//   const anyHandler: any = (input: TInput) => {
//     const execFunc = createHandler()
//     return execFunc(input)
//   }
//   const handler: NamedRequestHandler<TInput, TOutput, TErr> = anyHandler
//   return handler
// }

// tslint:disable-next-line:max-line-length
// type RequestHandlerDecorator<TInput = any, TOutput = any, TErr = any> = Decorator<NamedRequestHandler<TInput, TOutput, TErr>, PipeFunction<TInput, TOutput, TErr>>
// type RequestDecorator = <TInput, TOutput, TErr>(
// handler: NamedRequestHandler<TInput, TOutput, TErr>) => (input: TInput) => AsyncResult<TOutput, TErr>

// type Decorator<T, T2 = T> = (inp: T) => T2
