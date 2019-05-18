import { PipeFunction } from '../utils/neverthrow-extensions'

export default class SimpleContainer {
  private factories = new Map()
  private singletonScope = new DependencyScope()
  constructor(private getDependencyScope: () => DependencyScope, private setDependencyScope: (scope: DependencyScope) => void) {}

  public get<T>(key: string) {
    const instance = this.tryGet<T>(key)
    if (!instance) { throw new Error(`could not resolve ${key}`) }
    return instance
  }

  public tryGet<T>(key: string) {
    const instance = this.factories.get(key)() as T
    return instance
  }

  public tryGetF<T>(key: T) {
    const instance = this.factories.get(key)() as T
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

  public registerTransientF<T>(key: string, factory: () => T) {
    this.factories.set(key, factory)
  }

  public registerScopedF<T>(key: T, factory: () => T) {
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  public registerSingletonF<T>(key: T, factory: () => T) {
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  public registerInstanceF<T>(key: T, instance: T) {
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, () => instance))
  }

  public registerTransient<T>(key: string, factory: () => T) {
    this.factories.set(key, factory)
  }

  public registerScoped<T>(key: string, factory: () => T) {
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  public registerSingleton<T>(key: string, factory: () => T) {
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  public registerInstance<T>(key: string, instance: T) {
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, () => instance))
  }
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

export const generateKey = <T>(): T => (() => { throw new Error('not implemented function' )}) as any

type WithDependencies<TDependencies, T> = (deps: TDependencies) => T

// tslint:disable:max-line-length
export const setup = <TDependencies, TInput, TOutput, TError>(handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>): [WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>, PipeFunction<TInput, TOutput, TError>] => {
  return [handler, generateKey<ReturnType<typeof handler>>()]
}

export const setupWithDependenciesInt = <TDependencies>(deps: TDependencies) => <TInput, TOutput, TError>(
  handler: WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>,
): [WithDependencies<TDependencies, PipeFunction<TInput, TOutput, TError>>, PipeFunction<TInput, TOutput, TError>, TDependencies] => {
  // TODO: store deps on key? But then key and deps are coupled
  return [handler, generateKey<ReturnType<typeof handler>>(), deps]
}

export const setupWithExtraDependencies = <TExtraDependencies>(extraDeps: TExtraDependencies) =>
  <TDeps>(deps: TDeps) => setupWithDependenciesInt({...extraDeps, ...deps})
