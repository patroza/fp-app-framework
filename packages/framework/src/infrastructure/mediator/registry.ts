import { PipeFunction, Result } from "@fp-app/neverthrow-extensions"
import { Constructor, logger, setFunctionName } from "../../utils"
import assert from "../../utils/assert"
import { registerDomainEventHandler, registerIntegrationEventHandler } from "../createDependencyNamespace"
import { generateKey } from "../SimpleContainer"

export interface RequestContextBase { id: string, correllationId: string }

export type WithDependencies<TDependencies, T> = (deps: TDependencies) => T
export type WithDependenciesConfig<TDependencies, T> = (((deps: TDependencies) => T) & { $$inject: TDependencies })
export type EventHandlerWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<TDependencies, TInput, TOutput, TError>
export type UsecaseWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<TDependencies, TInput, TOutput, TError>

export const configureDependencies = <TDependencies, T>(
  deps: TDependencies,
  f: WithDependencies<TDependencies, T>,
): WithDependenciesConfig<TDependencies, T> => {
  const anyF: any = f
  anyF.$$inject = deps
  return anyF
}

type HandlerWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>

// tslint:disable-next-line:max-line-length
export type NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<TDependencies, NamedRequestHandler<TInput, TOutput, TError>> & HandlerInfo<TDependencies>

interface HandlerInfo<TDependencies> { name: string, type: HandlerType, $$inject: TDependencies }
type HandlerType = "COMMAND" | "QUERY" | "DOMAINEVENT" | "INTEGRATIONEVENT"

// tslint:disable-next-line:max-line-length
// type HandlerTuple<TDependencies, TInput, TOutput, TError> = readonly [
//   NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TError>,
//   TDependencies,
//   { name: string, type: HandlerType }
// ]

const registerUsecaseHandler = <TDependencies>(deps: TDependencies) =>
  (name: string, type: HandlerType) =>
    <TInput, TOutput, TError>(
      handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
    ) => {
      assert(!Object.keys(deps).some(x => !(deps as any)[x]), "Dependencies must not be null")

      const anyHandler: any = handler
      anyHandler.type = type
      anyHandler.$$inject = deps
      setFunctionName(handler, name)

      const newHandler = handler as NamedHandlerWithDependencies<TDependencies, TInput, TOutput, TError>

      // const r = [newHandler, deps, { name, type }] as const
      // dependencyMap.set(handler, r)
      requestAndEventHandlers.push(newHandler)
      return newHandler
    }

// tslint:disable-next-line:max-line-length
const createCommandWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(name, "COMMAND")(handler)
  logger.debug(`Created Command handler ${name}`)
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createQueryWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(name, "QUERY")(handler)
  logger.debug(`Created Query handler ${name}`)
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createDomainEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(`on${event.name}${name}`, "DOMAINEVENT")(handler)
  registerDomainEventHandler(event, handler)
  return newHandler
}

// tslint:disable-next-line:max-line-length
const createIntegrationEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  const newHandler = setupWithDeps(`on${event.name}${name}`, "INTEGRATIONEVENT")(handler)
  registerIntegrationEventHandler(event, handler)
  return newHandler
}

const copyHandler = (handler: any) => (...args: any[]) => handler(...args)

const requestAndEventHandlers: Array<NamedHandlerWithDependencies<any, any, any, any>> = []

const getRegisteredRequestAndEventHandlers = () => [...requestAndEventHandlers]

export {
  getRegisteredRequestAndEventHandlers,
  createCommandWithDeps, createDomainEventHandlerWithDeps,
  createIntegrationEventHandlerWithDeps,
  createQueryWithDeps,
}

export type requestType = <TInput, TOutput, TError>(
  requestHandler: NamedHandlerWithDependencies<any, TInput, TOutput, TError>,
  input: TInput,
) => Promise<Result<TOutput, TError>>

export type requestInNewScopeType = <TInput, TOutput, TError>(
  requestHandler: NamedHandlerWithDependencies<any, TInput, TOutput, TError>,
  input: TInput,
) => Promise<Result<TOutput, TError>>

export type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr> & HandlerInfo<any>

export const requestKey = generateKey<requestType>()
export const requestInNewScopeKey = generateKey<requestInNewScopeType>()

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
// handler: NamedRequestHandler<TInput, TOutput, TErr>) => (input: TInput) => Promise<Result<TOutput, TErr>>

// type Decorator<T, T2 = T> = (inp: T) => T2
