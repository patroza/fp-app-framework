import assert from '../utils/assert'
import { PipeFunction } from '../utils/neverthrow-extensions'

export default class SimpleContainer {
  private factories = new Map()
  private singletonScope = new DependencyScope()
  constructor(private getDependencyScope: () => DependencyScope, private setDependencyScope: (scope: DependencyScope) => void) {}

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
    assert.isNotNull({key, factory})
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  public registerSingletonC<T>(key: Constructor<T>, factory: () => T) {
    assert.isNotNull({key, factory})
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  public registerInstanceC<T>(key: Constructor<T>, instance: T) {
    assert.isNotNull({key, instance})
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, () => instance))
  }

  public registerTransientF<T>(key: T, factory: () => T) {
    this.factories.set(key, factory)
  }

  public registerScopedF<T>(key: T, factory: () => T) {
    assert.isNotNull({key, factory})
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  public registerSingletonF<T>(key: T, factory: () => T) {
    assert.isNotNull({key, factory})
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  public registerInstanceF<T>(key: T, instance: T) {
    assert.isNotNull({key, instance})
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

type WithDependencies<TDependencies, T> = (deps: TDependencies) => T

// tslint:disable-next-line:max-line-length
export type UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError> = [
  WithDependencies<TDependencies,
  PipeFunction<TInput, TOutput, TError>>,
  PipeFunction<TInput, TOutput, TError>,
  TDependencies,
  {name: string, type: 'COMMAND' | 'QUERY'}
]

// tslint:disable:max-line-length
// export const setup = <TDependencies, TInput, TOutput, TError>(handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>): [WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>, PipeFunction<TInput, TOutput, TError>] => {
//   return [handler, generateKey<ReturnType<typeof handler>>()]
// }

const dependencyMap = new Map()

export const setupWithDependenciesInt = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TError>(
  name: string,
  type: 'COMMAND' | 'QUERY',
  handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>,
): UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError> => {
  // TODO: store deps on key? But then key and deps are coupled
  assert(!Object.keys(deps).some(x => !(deps as any)[x]), 'Dependencies must not be null')

  const key = generateKey<ReturnType<typeof handler>>(name)
  const r = [handler, key, deps, { name, type }]
  dependencyMap.set(handler, r)
  return r as any
}

export const setupWithExtraDependencies = <TExtraDependencies>(extraDeps: TExtraDependencies) =>
  <TDeps>(deps: TDeps) => setupWithDependenciesInt({...extraDeps, ...deps})

type Constructor<T> = new (...args: any[]) => T

export const getRegisteredHandlers = () => [...dependencyMap.entries()]
