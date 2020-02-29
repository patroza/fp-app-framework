// TODO: There's obviously a lot of possibility to improve the API, and Implementation here ;-)

import "reflect-metadata"
import { Constructor, Disposable, setFunctionName } from "../utils"
import assert from "../utils/assert"

export default class SimpleContainer {
  private factories = new Map()
  private singletonScope = new DependencyScope()
  private decorators = new Map()
  private initializersF = new Map()
  private initializersC = new Map()
  private initializersO = new Map()
  constructor(
    private tryGetDependencyScope: () => DependencyScope,
    private setDependencyScope: (scope: DependencyScope) => void,
  ) {}

  getC<T>(key: Constructor<T>): T {
    const instance = this.tryCreateInstance<T>(key)
    if (!instance) {
      throw new Error(`could not resolve ${key}`)
    }
    return instance
  }

  // tslint:disable-next-line:ban-types
  getF<T extends Function>(key: T) {
    const f = this.tryCreateInstance<T>(key)
    if (!f) {
      throw new Error(`could not resolve ${key}`)
    }
    return f
  }

  getConcrete<TDependencies, T>(key: (deps: TDependencies) => T) {
    const f = this.tryCreateInstance<T>(key)
    if (!f) {
      throw new Error(`could not resolve ${key}`)
    }
    return f
  }

  getO<T>(key: Key<T>) {
    const f = this.tryCreateInstance<T>(key)
    if (!f) {
      throw new Error(`could not resolve ${key}`)
    }
    return f
  }

  createScope() {
    const scope = new DependencyScope()
    this.setDependencyScope(scope)
    return {
      dispose: () => scope.dispose(),
    }
  }

  registerTransientC<T>(key: Constructor<T>, factory: () => T) {
    this.registerFactoryC(key, factory)
  }

  registerScopedC<T>(key: Constructor<T>, factory: () => T) {
    this.registerFactoryC(key, factory, this.getDependencyScope)
  }

  registerSingletonC<T>(key: Constructor<T>, factory: () => T) {
    this.registerFactoryC(key, factory, this.getSingletonScope)
  }

  registerInstanceC<T>(key: Constructor<T>, instance: T) {
    this.registerFactoryC(key, () => instance, this.getSingletonScope)
  }

  registerTransientF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    this.registerFactoryF(key, factory)
  }

  registerPassthrough<T>(key: T, key2: T) {
    this.factories.set(key, this.factories.get(key2))
  }

  registerScopedO<T>(key: Key<T>, factory?: () => T) {
    const fact = factory || (() => this.createNewInstance(key as any))
    this.registerFactoryO(key, fact, this.getDependencyScope)
  }

  registerScopedF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    this.registerFactoryF(key, factory, this.getDependencyScope)
  }

  registerScopedF2<TDependencies, T extends (...args: any[]) => any>(
    key: Key<T>,
    impl: WithDependenciesConfig<TDependencies, T>,
  ) {
    const factory = () => this.createFunctionInstance(impl)
    setFunctionName(factory, impl.name || `f(${key.name}`)
    this.registerFactoryF(key, factory, this.getDependencyScope)
  }

  registerSingletonF2<TDependencies, T extends (...args: any[]) => any>(
    key: Key<T>,
    impl: WithDependenciesConfig<TDependencies, T>,
  ) {
    const factory = () => this.createFunctionInstance(impl)
    setFunctionName(factory, impl.name || `f(${key.name}`)
    this.registerSingletonF(key, factory)
  }

  registerSingletonConcrete<TDependencies, T>(
    key: WithDependenciesConfig<TDependencies, T> | (() => T),
    factory?: () => T,
  ) {
    if (!factory) {
      factory = () => this.createFunctionInstance(key)
      setFunctionName(factory, key.name)
    }

    // TODO
    this.registerSingletonF(key, factory as any)
  }

  registerScopedConcrete<TDependencies, T>(
    key: WithDependenciesConfig<TDependencies, T> | (() => T),
    factory?: () => T,
  ) {
    if (!factory) {
      factory = () => this.createFunctionInstance(key)
      setFunctionName(factory, key.name)
    }

    this.registerScopedF(key, factory as any)
  }

  registerDecorator<T extends (...args: any[]) => any>(forKey: T, ...decorators: any[]) {
    decorators.forEach(x => assert(x !== null, "decorator must not be null"))
    const current = this.decorators.get(forKey) || []
    current.push(...decorators)
    this.decorators.set(forKey, current)
  }

  registerSingletonF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    this.registerFactoryF(key, factory, this.getSingletonScope)
  }

  registerSingletonO<T>(key: Key<T>, factory?: () => T) {
    const fact = factory || (() => this.createNewInstance(key as any))
    // this.factories.set(key, () => this.singletonScope.getOrCreate(key, fact))
    this.registerFactoryO(key, fact, this.getSingletonScope)
  }

  registerSingletonC2<T>(key: Key<T>, impl: Constructor<T>) {
    const factory = () => this.createNewInstance(impl)
    this.registerSingletonC(key as any, factory)

    // Also register the concrete implementation
    this.factories.set(impl, this.factories.get(key))
  }

  registerScopedC2<T>(key: Key<T>, impl: Constructor<T>) {
    const factory = () => this.createNewInstance(impl)
    this.registerScopedC(key as any, factory)
    // Also register the concrete implementation
    this.factories.set(impl, this.factories.get(key))
  }

  // registerSingletonO2<TDependencies, T>(key: Key<T>, impl: WithDependenciesConfig<TDependencies, T>) {
  //   const factory = () => this.createFunctionInstance(impl)
  //   this.registerSingletonO(key, factory)
  // }

  registerInstanceF<T extends (...args: any[]) => any>(key: T, instance: T) {
    this.registerFactoryF(key, () => instance)
  }

  registerInitializerF<T extends (...args: any[]) => any>(
    key: Key<T> | "global",
    ...initializers: ((f: T, key: Key<T>) => void)[]
  ) {
    this.registerInitializer(this.initializersF, key, initializers)
  }

  registerInitializerC<T = any>(
    key: Constructor<T> | "global",
    ...initializers: ((instance: T, key: Constructor<T>) => void)[]
  ) {
    this.registerInitializer(this.initializersC, key, initializers)
  }

  registerInitializerO<T>(key: Key<T> | "global", ...initializers: ((instance: T, key: Key<T>) => void)[]) {
    this.registerInitializer(this.initializersO, key, initializers)
  }

  private registerInitializer(initializersMap: any, key: any, initializers: any[]) {
    const current = initializersMap.get(key) || []
    initializersMap.set(key, current.concat(initializers))
  }

  private createNewInstance<T>(constructor: Constructor<T>) {
    const keys = getDependencyKeys(constructor)
    let instance
    if (keys) {
      instance = new constructor(...keys.map(x => this.getO(x)))
    } else {
      instance = new constructor()
    }

    return instance
  }

  private readonly getDependencyScope = () => {
    const scope = this.tryGetDependencyScope()
    if (!scope) {
      throw new Error("There is no scope available, did you forget to .createScope()?")
    }
    return scope
  }

  private readonly getSingletonScope = () => this.singletonScope

  private fixName = (key: any, factory: any) => () => {
    const instance = factory()
    if (!instance.name) {
      setFunctionName(instance, factory.name || key.name)
    }
    return instance
  }

  private registerFactoryC<T>(key: any, factory: () => T, getScope?: () => DependencyScope) {
    this.registerFactory(key, factory, this.initializersC, this.resolveDecoratorsC, getScope)
  }
  private registerFactoryF<T>(key: any, factory: () => T, getScope?: () => DependencyScope) {
    this.registerFactory(key, this.fixName(key, factory), this.initializersF, this.resolveDecoratorsF, getScope)
  }
  private registerFactoryO<T>(key: any, factory: () => T, getScope?: () => DependencyScope) {
    this.registerFactory(key, factory, this.initializersO, () => factory, getScope)
  }
  private registerFactory<T>(
    key: any,
    factory: () => T,
    initializerMap: Map<any, any>,
    resolveDecorators: (key: any, factory: any) => any,
    getScope?: () => DependencyScope,
  ) {
    factory = this.hookInitializers(initializerMap, key, resolveDecorators(key, factory))
    if (!getScope) {
      this.factories.set(key, factory)
      return
    }
    this.factories.set(key, () => getScope().getOrCreate(key, factory))
  }

  private hookInitializers = (initializerMap: any, key: any, factory: any) => () => {
    const instance = factory()
    this.runInitializers(key, instance, initializerMap)
    return instance
  }

  private runInitializers(key: any, instance: any, initializersMap: Map<any, any[]>) {
    const globalInitializers = initializersMap.get("global")
    if (globalInitializers) {
      for (const i of globalInitializers) {
        i(instance, key)
      }
    }
    const initializers = initializersMap.get(key)
    if (!initializers || !initializers.length) {
      return
    }
    for (const i of initializers) {
      i(instance, key)
    }
  }

  private readonly createFunctionInstance = <TDependencies, T>(
    h: WithDependenciesConfig<TDependencies, T> | (() => T),
  ) => {
    const deps = getDependencyObjectKeys<TDependencies>(h)
    const resolved = h(this.resolveDependencies(deps))
    // setFunctionName(resolved, h.name)
    return resolved
  }

  private readonly resolveDependencies = <TDependencies>(deps: TDependencies) =>
    Object.keys(deps).reduce((prev, cur) => {
      const dAny = deps as any
      const key = dAny[cur]
      const pAny = prev as any
      pAny[cur] = this.getF(key)
      return prev
    }, {} as TDependencies)

  private tryCreateInstance = <T>(key: any) => {
    const factory = this.factories.get(key)
    const instance = factory() as T
    // if (!(instance as any).name) { setFunctionName(instance, key.name) }
    return instance
  }

  // TODO
  private readonly resolveDecoratorsC = <T>(_: Constructor<T>, factory: () => T) => {
    return factory
  }

  private readonly resolveDecoratorsF = <T extends (...args: any[]) => any>(key: T, factory: () => T) => () => {
    const decorators = this.decorators.get(key) || []

    if (!decorators.length) {
      return factory()
    }
    let handler = factory()
    const name = handler.name
    decorators.forEach((decorator: (inp: T) => T) => {
      // Be sure not to use `handler` as it can be rebound :-)
      const currentHandler = handler
      const anyDecoratedHandler: any = (...args: any[]) => {
        const decorate = this.getF(decorator)
        const decoratedHandler = decorate(currentHandler)
        return decoratedHandler(...args)
      }
      handler = anyDecoratedHandler
    })
    setFunctionName(handler, `$<${name}>`)
    return handler
  }

  // public registerTransient<T>(key: string, factory: () => T) {
  //   this.factories.set(key, factory)
  // }

  // public registerScoped<T>(key: string, factory: () => T) {
  //   this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  // }

  // public registerSingleton<T>(key: string, factory: () => T) {
  //   this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  // }

  // public registerInstance<T>(key: string, instance: T) {
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

// tslint:disable-next-line:max-classes-per-file
export class DependencyScope implements Disposable {
  instances: Map<any, any> = new Map()

  getOrCreate<T>(key: any, instanceCreator: () => T) {
    if (this.instances.has(key)) {
      return this.instances.get(key)
    }
    const instance = instanceCreator()
    this.instances.set(key, instance)
    return instance
  }

  dispose() {
    for (const d of this.instances.values()) {
      if (d.dispose) {
        d.dispose()
      }
    }
  }
}

export const injectSymbol = Symbol("$$inject")
export const requestTypeSymbol = Symbol("$$type")

export function generateKey<T>(name: string): Key<T> {
  const f = () => {
    throw new Error(`${name} not implemented function`)
  }
  if (name) {
    setFunctionName(f, name)
  }
  return f as any
}

export type Key<T> = T & { name: string }

/**
 * Registers the specified dependencyConstructors as the dependencies for the targeted class.
 *
 * Configuration will be inherited. Consecutive calls override the previous.
 * @param {Array<Function>} dependencyConstructors
 */
export const inject = (...dependencyConstructors: any[]): ClassDecorator => {
  dependencyConstructors.forEach(dependencyConstructor => assert.isNotNull({ dependencyConstructor }))
  // NOTE: Must have a {..} scope here or the Decorators exhibit weird behaviors..
  return (target: any) => {
    target[injectSymbol] = dependencyConstructors
  }
}

export const paramInject = (dependencyConstructor: any): ParameterDecorator => {
  assert.isNotNull({ dependencyConstructor })
  return (target: any, _: string | symbol, parameterIndex: number) => {
    if (!target[injectSymbol]) {
      target[injectSymbol] = []
    }
    target[injectSymbol][parameterIndex] = dependencyConstructor
  }
}

export const autoinject = (target: any) => {
  const metadata = Reflect.getMetadata("design:paramtypes", target) as any[]
  metadata.forEach(dependencyConstructor => assert.isNotNull({ dependencyConstructor }))

  // merge existing (ie placed by paraminject)
  if (Object.getOwnPropertySymbols(target).includes(injectSymbol)) {
    const existing = target[injectSymbol]
    const newInject = [...metadata]
    let i = 0
    for (const dep of existing) {
      if (dep) {
        newInject[i] = dep
      }
      i++
    }
    target[injectSymbol] = newInject
  } else {
    target[injectSymbol] = metadata
  }
}

const getDependencyKeys = (constructor: any) => (constructor[injectSymbol] as any[]) || []
const getDependencyObjectKeys = <TDependencies>(constructor: any): TDependencies => constructor[injectSymbol] || {}

const generateKeyFromFn = <T>(fun: (...args: any[]) => T) => generateKey<T>(fun.name)
const generateKeyFromC = <T>(C: Constructor<T>) => generateKey<T>(C.name)

// Ability to keep the factory function name so we can restore it for logging
// tslint:disable-next-line:ban-types
export const factoryOf = <T extends (...args: any[]) => any>(func: T, factory: (i: T) => ReturnType<T>) => {
  const newFactory = () => factory(func)
  setFunctionName(newFactory, func.name)
  return newFactory
}

export type WithDependencies<TDependencies, T> = (deps: TDependencies) => T
export interface InjectedDependencies<TDependencies> {
  [injectSymbol]: TDependencies
}
export type WithDependenciesConfig<TDependencies, T> = ((deps: TDependencies) => T) &
  InjectedDependencies<TDependencies>

export { generateKeyFromC, generateKeyFromFn }
