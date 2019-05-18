import assert from '../utils/assert'
import { PipeFunction } from '../utils/neverthrow-extensions'
import { registerEvent } from './eventRegistry'

export default class SimpleContainer {
  private factories = new Map()
  private singletonScope = new DependencyScope()
  constructor(private getDependencyScope: () => DependencyScope, private setDependencyScope: (scope: DependencyScope) => void) { }

  public getC<T>(key: Constructor<T>): T {
    const instance = this.tryGetC<T>(key)
    if (!instance) { throw new Error(`could not resolve ${key}`) }
    return instance
  }

  public tryGetC<T>(key: Constructor<T>): T {
    const factory = this.factories.get(key)
    const instance = factory() as T
    return instance
  }

  public tryGetF<T>(key: T) {
    const factory = this.factories.get(key)
    const instance = factory() as T
    return instance
  }

  public getF<T>(key: T) {
    const f = this.tryGetF<T>(key)
    if (!f) { throw new Error(`could not resolve ${key}`) }
    return f
  }

  public createScope() {
    const scope = new DependencyScope()
    this.setDependencyScope(scope)
    // return {
    //   dispose: () => scope.dispose(),
    // }
  }

  public registerTransientC<T>(key: Constructor<T>, factory: () => T) {
    this.factories.set(key, factory)
  }

  public registerScopedC<T>(key: Constructor<T>, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  public registerSingletonC<T>(key: Constructor<T>, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  public registerInstanceC<T>(key: Constructor<T>, instance: T) {
    assert.isNotNull({ key, instance })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, () => instance))
  }

  public registerTransientF<T>(key: T, factory: () => T) {
    this.factories.set(key, factory)
  }

  public registerScopedF<T>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  public registerSingletonF<T>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  public registerInstanceF<T>(key: T, instance: T) {
    assert.isNotNull({ key, instance })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, () => instance))
  }

  // public registerTransient<T>(key: string, factory: () => T) {
  //   assert.isNotNull({key, factory})
  //   this.factories.set(key, factory)
  // }

  // public registerScoped<T>(key: string, factory: () => T) {
  //   assert.isNotNull({key, factory})
  //   this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  // }

  // public registerSingleton<T>(key: string, factory: () => T) {
  //   assert.isNotNull({key, factory})
  //   this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  // }

  // public registerInstance<T>(key: string, instance: T) {
  //   assert.isNotNull({key, instance})
  //   this.factories.set(key, () => this.singletonScope.getOrCreate(key, () => instance))
  // }

  // public get<T>(key: string) {
  //   const instance = this.tryGet<T>(key)
  //   if (!instance) { throw new Error(`could not resolve ${key}`) }
  //   return instance
  // }

  // public tryGet<T>(key: string) {
  //   const factory = this.factories.get(key)
  //   console.log('factory', key, factory)
  //   const instance = factory() as T
  //   return instance
  // }

}

const tryOrNull = <T, T2>(f: () => T | undefined, f2: (i: T) => T2) => {
  const result = f()
  if (!result) { return null }
  return f2(result)
}

// tslint:disable-next-line:max-classes-per-file
export class DependencyScope {
  public instances: Map<any, any> = new Map()

  public getOrCreate<T>(key: any, instanceCreator: () => T) {
    if (this.instances.has(key)) { return this.instances.get(key) }
    const instance = instanceCreator()
    this.instances.set(key, instance)
    return instance
  }

  public dispose() {
    for (const d of this.instances.values()) {
      if (d.dispose) {
        d.dispose()
      }
    }
  }
}

export const generateKey = <T>(name?: string): T => {
  const f = () => { throw new Error(`${name} not implemented function`) }
  f.$$name = name
  return f as any
}

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
// export const setup = <TDependencies, TInput, TOutput, TError>(handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>): [WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>, PipeFunction<TInput, TOutput, TError>] => {
//   return [handler, generateKey<ReturnType<typeof handler>>()]
// }

// Make variations for: createCommand, query and event, with auto stuff.

const dependencyMap = new Map()

export const setupWithDependenciesInt = <TDependencies>(deps: TDependencies) =>
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

export type Constructor<T> = new (...args: any[]) => T

export const getRegisteredHandlers = () => [...dependencyMap.entries()]

// tslint:disable-next-line:max-line-length
export const createCommandWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = setupWithDependenciesInt(deps)
  const resolved = setupWithDeps(name, 'COMMAND')(handler)
  return resolved
}

// tslint:disable-next-line:max-line-length
export const createQueryWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = setupWithDependenciesInt(deps)
  const resolved = setupWithDeps(name, 'QUERY')(handler)
  return resolved
}

// tslint:disable-next-line:max-line-length
export const createEventHandlerWithDeps = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TErr>(event: Constructor<TInput>, name: string, handler: UsecaseWithDependencies<TDependencies, TInput, TOutput, TErr>) => {
  const setupWithDeps = setupWithDependenciesInt(deps)
  const resolved = setupWithDeps(`on${event.name}${name}`, 'EVENT')(handler)
  registerEvent(event, resolved)
  return resolved
}

// export const setupWithDependencies = setupWithExtraDependencies({ context: RequestContextKey })

// export const setupWithExtraDependencies = <TExtraDependencies>(extraDeps: TExtraDependencies) =>
//   <TDeps>(deps: TDeps) => setupWithDependenciesInt({ ...extraDeps, ...deps })
