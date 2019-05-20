import { benchLog, logger, setFunctionName } from 'fp-app-framework/utils'
import assert from '../utils/assert'
import { flatMap, flatTee, liftType, mapErr, PipeFunction, Result } from '../utils/neverthrow-extensions'
import { UnitOfWork } from './context.base'
import { DbError } from './errors'
import { Constructor } from './misc'
import SimpleContainer, { generateKey } from './SimpleContainer'

export type WithDependencies<TDependencies, T> = (deps: TDependencies) => T

export type EventHandlerWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<TDependencies, TInput, TOutput, TError>
export type UsecaseWithDependencies<TDependencies, TInput, TOutput, TError> = HandlerWithDependencies<TDependencies, TInput, TOutput, TError>

type HandlerWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>
type HandlerType = 'COMMAND' | 'QUERY' | 'EVENT'

// tslint:disable-next-line:max-line-length
type HandlerTuple<TDependencies, TInput, TOutput, TError> = [
  HandlerWithDependencies<TDependencies, TInput, TOutput, TError>,
  PipeFunction<TInput, TOutput, TError>,
  TDependencies,
  { name: string, type: HandlerType }
]

// tslint:disable:max-line-length
// export function setup<TDependencies, TInput, TOutput, TError>(handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>): [WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>, PipeFunction<TInput, TOutput, TError>] {
//   return [handler, generateKey<ReturnType<typeof handler>>()]
// }

const registerUsecaseHandler = <TDependencies>(deps: TDependencies) =>
  (name: string, type: HandlerType) =>
    <TInput, TOutput, TError>(
      handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
    ): void => {
      // TODO: store deps on key? But then key and deps are coupled
      assert(!Object.keys(deps).some(x => !(deps as any)[x]), 'Dependencies must not be null')

      const key = generateKey<ReturnType<typeof handler>>(name)
      const r = [handler, key, deps, { name, type }] as [any, any, any, any]
      dependencyMap.set(handler, r)
    }

// tslint:disable-next-line:max-line-length
const createCommandWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(name, 'COMMAND')(handler)
  return handler
}

// tslint:disable-next-line:max-line-length
const createQueryWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(name, 'QUERY')(handler)
  return handler
}

// tslint:disable-next-line:max-line-length
const createEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = registerUsecaseHandler(deps)
  setupWithDeps(`on${event.name}${name}`, 'EVENT')(handler)
  registerEventHandler(event, dependencyMap.get(handler)![1])
  return handler
}

const getRegisteredRequestAndEventHandlers = () => [...dependencyMap.entries()]
const getRegisteredEventHandlers = () => [...handlerMap.entries()]
const registerEventHandler = (event: any, handler: any) => {
  const current = handlerMap.get(event) || []
  current.push(handler)
  handlerMap.set(event, current)
}

const getHandlerImpl = (container: SimpleContainer, uowKey: UnitOfWork): getRequestHandlerType => handler => {
  const usecaseHandler = getDependencyMap(handler)!
  const { name, type } = usecaseHandler[3]

  // These execute in reverse order
  const decoratorFactories = [
    () => uowDecorator(container.getF(uowKey)),
    () => loggingDecorator(),
  ]
  return generateConfiguredHandler(
    name,
    () => container.getF(usecaseHandler[1]),
    decoratorFactories,
    type === 'COMMAND',
  )
}

const getDependencyMap = (handler: WithDependencies<any, PipeFunction<any, any, any>>) => dependencyMap.get(handler)

export {
  getDependencyMap,
  getHandlerImpl,
  getRegisteredRequestAndEventHandlers, getRegisteredEventHandlers, registerEventHandler,
  createCommandWithDeps, createEventHandlerWithDeps,
  createQueryWithDeps,
}

const dependencyMap = new Map<HandlerWithDependencies<any, any, any, any>, HandlerTuple<any, any, any, any>>()

// tslint:disable-next-line:ban-types
const handlerMap = new Map<any, any[]>() // Array<[Function, Function, {}]>

const generateConfiguredHandler = <TInput, TOutput, TErr>(
  // Have to specify name as we don't use classes to retrieve the name from
  name: string,
  createHandler: () => PipeFunction<TInput, TOutput, TErr>,
  decoratorFactories: Array<() => RequestHandlerDecorator>,
  isCommand = false,
): NamedRequestHandler<TInput, TOutput, TErr> => {
  const anyHandler: any = (input: TInput) => {
    const execFunc = createHandler()
    return execFunc(input)
  }
  // TODO: manage way how we don't have to apply this to every decorator?
  setFunctionName(anyHandler, name)
  anyHandler.isCommand = isCommand
  let handler: NamedRequestHandler<TInput, TOutput, TErr> = anyHandler

  decoratorFactories.forEach(createDecorator => {
    // Be sure not to use `handler` as it can be rebound :-)
    const currentHandler = handler
    const anyDecoratedHandler: any = (input: TInput) => {
      const decorate = createDecorator()
      const decoratedHandler = decorate(currentHandler)
      return decoratedHandler(input)
    }
    setFunctionName(anyDecoratedHandler, name)
    anyDecoratedHandler.isCommand = isCommand

    handler = anyDecoratedHandler
  })

  return handler
}

const loggingDecorator = () =>
  <TInput, TOutput, TErr>(handler: NamedRequestHandler<TInput, TOutput, TErr>) =>
    (input: TInput) => benchLog(async () => {
      const t = handler.isCommand ? 'Command' : 'Query'
      const prefix = `${handler.name} ${t}`
      logger.log(`${prefix} input`, input)
      const result = await handler(input)
      logger.log(`${prefix} result`, result)
      return result
    }, handler.name)

const uowDecorator = (unitOfWork: UnitOfWork) =>
  <TInput, TOutput, TErr>(handler: NamedRequestHandler<TInput, TOutput, TErr>) =>
    (input: TInput) => {
      if (!handler.isCommand) {
        return handler(input)
      }

      return handler(input)
        .pipe(
          mapErr(liftType<TErr | DbError>()),
          flatMap(flatTee(unitOfWork.save)),
        )
    }

// tslint:disable-next-line:max-line-length
type getRequestHandlerType = <TDependencies, TInput, TOutput, TError>(usecaseHandler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>) => NamedRequestHandler<TInput, TOutput, TError>

type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr | DbError> & { name: string, isCommand: boolean }

type Decorator<T, T2 = T> = (inp: T) => T2

// tslint:disable-next-line:max-line-length
type RequestHandlerDecorator<TInput = any, TOutput = any, TErr = any> = Decorator<NamedRequestHandler<TInput, TOutput, TErr>, PipeFunction<TInput, TOutput, TErr>>

export type requestType = <TInput, TOutput, TError>(requestHandler: UsecaseWithDependencies<any, TInput, TOutput, TError>, input: TInput) => Promise<Result<TOutput, TError | DbError>>
export type publishType = <TInput, TOutput, TError>(eventHandler: PipeFunction<TInput, TOutput, TError>, event: TInput) => Promise<Result<TOutput, TError>>
