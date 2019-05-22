import { Constructor, setFunctionName } from '../utils'
import assert from '../utils/assert'

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

    const factory = this.factories.get(key)
    const instance = factory() as T
    return instance
  }

  tryGetF<T>(key: T) {
    assert.isNotNull({ key })

    const factory = this.factories.get(key)
    const instance = factory() as T
    return instance
  }

  getF<T>(key: T) {
    assert.isNotNull({ key })

    const f = this.tryGetF<T>(key)
    if (!f) { throw new Error(`could not resolve ${key}`) }
    return f
  }

  createScope() {
    const scope = new DependencyScope()
    this.setDependencyScope(scope)
    // return {
    //   dispose: () => scope.dispose(),
    // }
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

  registerScopedO<T>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, factory)))
  }

  registerScopedF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => tryOrNull(() => this.getDependencyScope(), s => s.getOrCreate(key, this.resolveDecoratorsF(key, factory))))
  }

  registerDecorator<T extends (...args: any[]) => any>(forKey: T, ...decorators: any[]) {
    const current = this.decorators.get(forKey) || []
    current.push(...decorators)
    this.decorators.set(forKey, current)
  }

  registerSingletonF<T extends (...args: any[]) => any>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, this.resolveDecoratorsF(key, factory)))
  }

  registerSingletonO<T>(key: T, factory: () => T) {
    assert.isNotNull({ key, factory })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, factory))
  }

  registerInstanceF<T extends (...args: any[]) => any>(key: T, instance: T) {
    assert.isNotNull({ key, instance })
    this.factories.set(key, () => this.singletonScope.getOrCreate(key, this.resolveDecoratorsF(key, () => instance)))
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
export class DependencyScope {
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

export function generateKey<T>(name?: string): T {
  const f = () => { throw new Error(`${name} not implemented function`) }
  if (name) { setFunctionName(f, name) }
  return f as any
}

const generateKeyFromFn = <T>(fun: (...args: any[]) => T): T => generateKey(fun.name)

export {
  generateKeyFromFn,
}
