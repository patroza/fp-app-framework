import assert from '../utils/assert'
import { Constructor } from './misc'

export default class SimpleContainer {
  private factories = new Map()
  private singletonScope = new DependencyScope()
  constructor(private getDependencyScope: () => DependencyScope, private setDependencyScope: (scope: DependencyScope) => void) { }

  public getC<T>(key: Constructor<T>): T {
    assert.isNotNull({ key })

    const instance = this.tryGetC<T>(key)
    if (!instance) { throw new Error(`could not resolve ${key}`) }
    return instance
  }

  public tryGetC<T>(key: Constructor<T>): T {
    assert.isNotNull({ key })

    const factory = this.factories.get(key)
    const instance = factory() as T
    return instance
  }

  public tryGetF<T>(key: T) {
    assert.isNotNull({ key })

    const factory = this.factories.get(key)
    const instance = factory() as T
    return instance
  }

  public getF<T>(key: T) {
    assert.isNotNull({ key })

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
    assert.isNotNull({ key, factory })
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
    assert.isNotNull({ key, factory })
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

export const generateKeyFromFn = <T>(fun: (...args: any[]) => T): T => {
  const f = () => { throw new Error(`${fun.name} not implemented function`) }
  f.$$name = fun.name
  return f as any
}
