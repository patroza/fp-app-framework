import assert from '../utils/assert'
import { PipeFunction } from '../utils/neverthrow-extensions'
import { Constructor } from './misc'
import { generateKey } from './SimpleContainer'

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

export {
  getRegisteredRequestAndEventHandlers, getRegisteredEventHandlers, registerEventHandler,
  setupWithDependenciesInt, createCommandWithDeps, createEventHandlerWithDeps,
  createQueryWithDeps,
}

const dependencyMap = new Map()

// tslint:disable-next-line:ban-types
const handlerMap = new Map<any, any[]>() // Array<[Function, Function, {}]>