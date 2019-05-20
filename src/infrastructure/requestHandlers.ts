import { benchLog, logger, setFunctionName } from 'fp-app-framework/utils'
import assert from '../utils/assert'
import { flatMap, flatTee, liftType, mapErr, PipeFunction } from '../utils/neverthrow-extensions'
import { UnitOfWork } from './context.base'
import { DbError } from './errors'
import { Constructor } from './misc'
import SimpleContainer, { generateKey } from './SimpleContainer'

export type WithDependencies<TDependencies, T> = (deps: TDependencies) => T
type HandlerType = 'COMMAND' | 'QUERY' | 'EVENT'

export type UsecaseWithDependencies<TDependencies, TInput, TOutput, TError> = WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>

// tslint:disable-next-line:max-line-length
export type UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError> = [
  UsecaseWithDependencies<TDependencies, TInput, TOutput, TError>,
  PipeFunction<TInput, TOutput, TError>,
  TDependencies,
  { name: string, type: HandlerType }
]

// tslint:disable:max-line-length
// export function setup<TDependencies, TInput, TOutput, TError>(handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>): [WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>, PipeFunction<TInput, TOutput, TError>] {
//   return [handler, generateKey<ReturnType<typeof handler>>()]
// }

const setupWithDependenciesInt = <TDependencies>(deps: TDependencies) =>
  (name: string, type: HandlerType) =>
    <TInput, TOutput, TError>(
      handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>,
    ): UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError> => {
      // TODO: store deps on key? But then key and deps are coupled
      assert(!Object.keys(deps).some(x => !(deps as any)[x]), 'Dependencies must not be null')

      const key = generateKey<ReturnType<typeof handler>>(name)
      const r = [handler, key, deps, { name, type }]
      dependencyMap.set(handler, r)
      return r as any
    }

// tslint:disable-next-line:max-line-length
const createCommandWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = setupWithDependenciesInt(deps)
  const resolved = setupWithDeps(name, 'COMMAND')(handler)
  return resolved
}

// tslint:disable-next-line:max-line-length
const createQueryWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = setupWithDependenciesInt(deps)
  const resolved = setupWithDeps(name, 'QUERY')(handler)
  return resolved
}

// tslint:disable-next-line:max-line-length
const createEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = setupWithDependenciesInt(deps)
  const resolved = setupWithDeps(`on${event.name}${name}`, 'EVENT')(handler)
  registerEventHandler(event, resolved)
  return resolved
}

// const setupWithDependencies = setupWithExtraDependencies({ context: RequestContextKey })

// const setupWithExtraDependencies = <TExtraDependencies>(extraDeps: TExtraDependencies) =>
//   <TDeps>(deps: TDeps) => setupWithDependenciesInt({ ...extraDeps, ...deps })

const getRegisteredRequestAndEventHandlers = () => [...dependencyMap.entries()]
const getRegisteredEventHandlers = () => [...handlerMap.entries()]
const registerEventHandler = (event: any, handler: any) => {
  const current = handlerMap.get(event) || []
  current.push(handler)
  handlerMap.set(event, current)
}

const getHandlerImpl = (container: SimpleContainer, uowKey: UnitOfWork): getHandlerType => usecaseHandler => {
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

export {
  getHandlerImpl,
  getRegisteredRequestAndEventHandlers, getRegisteredEventHandlers, registerEventHandler,
  setupWithDependenciesInt, createCommandWithDeps, createEventHandlerWithDeps,
  createQueryWithDeps,
}

const dependencyMap = new Map()

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
      const requestType = handler.isCommand ? 'Command' : 'Query'
      const prefix = `${handler.name} ${requestType}`
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
export type getHandlerType = <TDependencies, TInput, TOutput, TError>(usecaseHandler: UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError>) => NamedRequestHandler<TInput, TOutput, TError>

type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr | DbError> & { name: string, isCommand: boolean }

type Decorator<T, T2 = T> = (inp: T) => T2

// tslint:disable-next-line:max-line-length
type RequestHandlerDecorator<TInput = any, TOutput = any, TErr = any> = Decorator<NamedRequestHandler<TInput, TOutput, TErr>, PipeFunction<TInput, TOutput, TErr>>
