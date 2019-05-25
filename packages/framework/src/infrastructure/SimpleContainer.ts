import { Constructor, Disposable, setFunctionName } from "../utils"
import assert from "../utils/assert"

import "reflect-metadata"

export default class SimpleContainer {
  private factories = new Map()
  private singletonScope = new DependencyScope()
  private decorators = new Map()
  constructor(private getDependencyScope: () => DependencyScope, private setDependencyScope: (scope: DependencyScope) => void) { }

  getC<T>(key: Constructor<T>): T {
    assert.isNotNull({ key })

    const instance = this.tryGetC<T>(key)
    if (!instance) { throw new Error(`could not resolve ${key}`) }
    return instance
  }

  tryGetC<T>(key: Constructor<T>): T {
    assert.isNotNull({ key })

    return this.tryCreateInstance<T>(key)
  }

  // tslint:disable-next-line:ban-types
  tryGetF<T extends Function>(key: T) {
    assert.isNotNull({ key })

    return this.tryCreateInstance<T>(key)
  }

  // tslint:disable-next-line:ban-types
  tryGetConcrete<TDependencies, T>(key: (deps: TDependencies) => T) {
    assert.isNotNull({ key })

    return this.tryCreateInstance<T>(key)
  }

  tryGetO<T>(key: Key<T>) {
    assert.isNotNull({ key })

    return this.tryCreateInstance<T>(key)
  }

  // tslint:disable-next-line:ban-types
  getF<T extends Function>(key: T) {
    assert.isNotNull({ key })

    const f = this.tryGetF<T>(key)
    if (!f) { throw new Error(`could not resolve ${key}`) }
    return f
  }

  getConcrete<TDependencies, T>(key: (deps: TDependencies) => T) {
    assert.isNotNull({ key })

    const f = this.tryGetConcrete(key)
    if (!f) { throw new Error(`could not resolve ${key}`) }
    return f
  }

  getO<T>(key: Key<T>) {
    assert.isNotNull({ key })

    const f = this.tryGetO<T>(key)
    if (!f) { throw new Error(`could not resolve ${key}`) }
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
    assert.isNotNull({ key, factory })
    this.factories.set(key, this.resolveDecoratorsC(key, factory))
  }

  registerScopedC<T>(key: Constructor<T>, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, this.resolveDecoratorsC(key, factory))))
  }

  registerSingletonC<T>(key: Constructor<T>, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, this.resolveDecoratorsC(key, factory)))
  }

  registerInstanceC<T>(key: Constructor<T>, instance: T) {
    assert.isNotNull({ key, instance })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, this.resolveDecoratorsC(key, () => instance)))
  }

  registerTransientF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, this.resolveDecoratorsF(key, factory))
  }

  registerScopedO<T>(key: T & { name: string }, factory?: () => T) {
    assert.isNotNull({ key })
    const fact = factory || (() => this.createNewInstance(key as any))
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, fact)))
  }

  registerScopedF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, this.resolveDecoratorsF(key, factory))))
  }

  registerScopedF2<TDependencies, T extends (...args: any[]) => any>(key: Key<T>, impl: WithDependenciesConfig<TDependencies, T>) {
    assert.isNotNull({ key, impl })
    const factory = () => this.createFunctionInstance(impl)
    this.registerScopedF(key, factory)
  }

  registerSingletonF2<TDependencies, T extends (...args: any[]) => any>(key: Key<T>, impl: WithDependenciesConfig<TDependencies, T>) {
    assert.isNotNull({ key, impl })
    const factory = () => this.createFunctionInstance(impl)
    this.registerSingletonF(key, factory)
  }

  registerSingletonConcrete<TDependencies, T>(key: WithDependenciesConfig<TDependencies, T> | (() => T), factory?: () => T) {
    assert.isNotNull({ key })

    if (!factory) {
      factory = () => this.createFunctionInstance(key)
    }

    // TODO
    this.registerSingletonF(key, factory as any)
  }

  registerScopedConcrete<TDependencies, T>(key: WithDependenciesConfig<TDependencies, T> | (() => T), factory?: () => T) {
    assert.isNotNull({ key })

    if (!factory) {
      factory = () => this.createFunctionInstance(key)
    }

    this.registerScopedF(key, factory as any)
  }

  registerDecorator<T extends (...args: any[]) => any>(forKey: T, ...decorators: any[]) {
    assert.isNotNull({ forKey, decorators })
    decorators.forEach(x => assert(x !== null, "decorator must not be null"))
    const current = this.decorators.get(forKey) || []
    current.push(...decorators)
    this.decorators.set(forKey, current)
  }

  registerSingletonF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, this.resolveDecoratorsF(key, factory)))
  }

  registerSingletonO<T>(key: T & { name: string }, factory?: () => T) {
    assert.isNotNull({ key, factory })
    const fact = factory || (() => this.createNewInstance(key as any))
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, fact))
  }

  registerSingletonO2<T>(key: T & { name: string }, impl: Constructor<T>) {
    assert.isNotNull({ key, impl })
    const factory = () => this.createNewInstance(impl)
    this.registerSingletonO(key, factory)

    // Also register the concrete implementation
    this.factories.set(impl, this.factories.get(key))
  }

  registerScopedO2<T>(key: T & { name: string }, impl: Constructor<T>) {
    assert.isNotNull({ key, impl })
    const factory = () => this.createNewInstance(impl)
    this.registerScopedO(key, factory)
    // Also register the concrete implementation
    this.factories.set(impl, this.factories.get(key))
  }

  // registerSingletonO2<TDependencies, T>(key: Key<T>, impl: WithDependenciesConfig<TDependencies, T>) {
  //   assert.isNotNull({ key, impl })
  //   const factory = () => this.createFunctionInstance(impl)
  //   this.registerSingletonO(key, factory)
  // }

  registerInstanceF<T extends (...args: any[]) => any>(key: T, instance: T) {
    assert.isNotNull({ key, instance })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, this.resolveDecoratorsF(key, () => instance)))
  }

  createNewInstance<T>(constructor: Constructor<T>) {
    const keys = getDependencyKeys(constructor)
    let instance
    if (keys) {
      instance = new constructor(...keys.map(x => this.getO(x)))
    } else {
      instance = new constructor()
    }

    return instance
  }

  private readonly createFunctionInstance = <TDependencies, T>(h: WithDependenciesConfig<TDependencies, T> | (() => T)) => {
    const deps = getDependencyObjectKeys<TDependencies>(h)
    const resolved = h(this.resolveDependencies(deps))
    setFunctionName(resolved, h.name)
    return resolved
  }

  private readonly resolveDependencies = <TDependencies>(deps: TDependencies) => Object.keys(deps).reduce((prev, cur) => {
    const dAny = deps as any
    const key = dAny[cur]
    const pAny = prev as any
    pAny[cur] = this.getF(key)
    return prev
  }, {} as TDependencies)

  private tryCreateInstance = <T>(key: any) => {
    const factory = this.factories.get(key)
    const instance = factory() as T
    if (!(instance as any).name) { setFunctionName(instance, key.name) }
    return instance
  }

  // TODO
  private resolveDecoratorsC<T>(_: Constructor<T>, factory: () => T) {
    return factory
  }

  private resolveDecoratorsF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    return () => {
      const decorators = this.decorators.get(key) || []

      if (!decorators.length) { return factory() }
      let handler = factory()
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
      return handler
    }
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
export class DependencyScope implements Disposable {
  instances: Map<any, any> = new Map()

  getOrCreate<T>(key: any, instanceCreator: () => T) {
    if (this.instances.has(key)) { return this.instances.get(key) }
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

export function generateKey<T>(name?: string): Key<T> {
  const f = () => { throw new Error(`${name} not implemented function`) }
  if (name) { setFunctionName(f, name) }
  return f as any
}

export type Key<T> = T & { name: string; }

/**
 * Registers the specified dependencyConstructors as the dependencies for the targeted class.
 *
 * Configuration will be inherited. Consecutive calls override the previous.
 * @param {Array<Function>} dependencyConstructors
 */
export const inject = (...dependencyConstructors: any[]): ClassDecorator => {
  dependencyConstructors.forEach(x => assert.isNotNull({ x }))
  // NOTE: Must have a {..} scope here or the Decorators exhibit weird behaviors..
  return (target: any) => {
    target.$$inject = dependencyConstructors
  }
}

export const paramInject = (dependencyConstructor: any): ParameterDecorator => {
  return (target: any, _: string | symbol, parameterIndex: number) => {
    if (!target.$$inject) {
      target.$$inject = []
    }
    target.$$inject[parameterIndex] = dependencyConstructor
  }
}

export const autoinject = (target: any) => {
  const metadata = Reflect.getMetadata("design:paramtypes", target)
  // merge existing (ie placed by paraminject)
  if (target.hasOwnProperty("$$inject")) {
    const existing = target.$$inject
    const newInject = [...metadata]
    let i = 0
    for (const dep of existing) {
      if (dep) {
        newInject[i] = dep
      }
      i++
    }
    target.$$inject = newInject
  } else {
    target.$$inject = metadata
  }
}

const getDependencyKeys = (constructor: any) => constructor.$$inject as any[] || []
const getDependencyObjectKeys = <TDependencies>(constructor: any): TDependencies => constructor.$$inject || {}

const generateKeyFromFn = <T>(fun: (...args: any[]) => T): T => generateKey(fun.name)

export type WithDependencies<TDependencies, T> = (deps: TDependencies) => T
export type WithDependenciesConfig<TDependencies, T> = (((deps: TDependencies) => T) & { $$inject: TDependencies })

export {
  generateKeyFromFn,
}
