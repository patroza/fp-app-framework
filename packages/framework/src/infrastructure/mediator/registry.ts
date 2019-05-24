import { PipeFunction, Result } from "@fp-app/neverthrow-extensions"
import { Constructor, logger, setFunctionName } from "../../utils"
import assert from "../../utils/assert"
import { registerDomainEventHandler, registerIntegrationEventHandler } from "../createDependencyNamespace"
import { generateKey } from "../SimpleContainer"

export interface RequestContextBase { id: string, correllationId: string }

export type WithDependencies<TDependencies, T> = (deps: TDependencies) => T
export type EventHandlerWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<TDependencies, TInput, TOutput, TError>
export type UsecaseWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<TDependencies, TInput, TOutput, TError>

type HandlerWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>
type HandlerType = "COMMAND" | "QUERY" | "EVENT"

// tslint:disable-next-line:max-line-length
type HandlerTuple<TDependencies, TInput, TOutput, TError> = readonly [
  HandlerWithDependencies<TDependencies, TInput, TOutput, TError>,
  NamedRequestHandler<TInput, TOutput, TError>,
  TDependencies,
  { name: string, type: HandlerType }
]

const registerUsecaseHandler = <TDependencies>(deps: TDependencies) =>
  (name: string, type: HandlerType) =>
    <TInput, TOutput, TError>(
      handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
    ): void => {
      assert(!Object.keys(deps).some(x => !(deps as any)[x]), "Dependencies must not be null")

      const key = generateKey<NamedRequestHandler<TInput, TOutput, TError>>(name)
      const anyHandler: any = handler
      anyHandler.isCommand = type === "COMMAND"
      setFunctionName(handler, name)

      const r = [handler, key, deps, { name, type }] as const
      dependencyMap.set(handler, r)
    }

// tslint:disable-next-line:max-line-length
const createCommandWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(name, "COMMAND")(handler)
  logger.debug(`Created Command handler ${name}`)
  return handler
}

// tslint:disable-next-line:max-line-length
const createQueryWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(name, "QUERY")(handler)
  logger.debug(`Created Query handler ${name}`)
  return handler
}

// tslint:disable-next-line:max-line-length
const createDomainEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(`on${event.name}${name}`, "EVENT")(handler)
  registerDomainEventHandler(event, dependencyMap.get(handler)![1])
  return handler
}

// tslint:disable-next-line:max-line-length
const createIntegrationEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  handler = copyHandler(handler)
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(`on${event.name}${name}`, "EVENT")(handler)
  registerIntegrationEventHandler(event, dependencyMap.get(handler)![1])
  return handler
}

const copyHandler = (handler: any) => (...args: any[]) => handler(...args)

const getRegisteredRequestAndEventHandlers = () => [...dependencyMap.entries()]

const getHandlerKey = (handler: UsecaseWithDependencies<any, any, any, any>) => {
  const usecaseHandler = dependencyMap.get(handler)!
  return usecaseHandler[1]
}

export {
  getHandlerKey,
  getRegisteredRequestAndEventHandlers,
  createCommandWithDeps, createDomainEventHandlerWithDeps,
  createIntegrationEventHandlerWithDeps,
  createQueryWithDeps,
}

export type requestType = <TInput, TOutput, TError>(
  requestHandler: UsecaseWithDependencies<any, TInput, TOutput, TError>,
  input: TInput,
) => Promise<Result<TOutput, TError>>

export type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr> & { name: string, isCommand: boolean }

export const requestKey = generateKey<requestType>()

const dependencyMap = new Map<HandlerWithDependencies<any, any, any, any>, HandlerTuple<any, any, any, any>>()

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
