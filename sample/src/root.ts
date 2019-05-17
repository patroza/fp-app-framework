import { createDependencyNamespace, generateConfiguredHandler } from 'fp-app-framework/src/infrastructure/namespace'

import { RequestContextBase } from '@fp-app-framework/infrastructure/misc'
import create from './feature/usecases/create'
import get from './feature/usecases/get'

const createRoot = () => {
  const { getDependencyScope, setDependencyScope, ns } = createDependencyNamespace(namespace)
  const bindLogger = (fnc: (...args2: any[]) => void) => (...args: any[]) => {
    const scope = getDependencyScope()
    // tslint:disable-next-line:no-console
    if (!scope) { return fnc('[root context]', ...args) }
    // tslint:disable-next-line:no-console
    const id = scope.context.correllationId === scope.context.id
      ? scope.context.id
      : `${scope.context.id} (${scope.context.correllationId})`
    return fnc(`[${id}]`, ...args)
  }

  //////////////////
  // singleton dependencies
  // EventHandler dependencies

  //////////////////
  // scoped dependencies
  const createScopedDependencies = () => {
    const scope = getDependencyScope()

    // Usecases and Domain Events within the same Request, should execute within the same Dependency scope
    // Integration Events should execute in a new scope.
    // Circular dependencies between eventHandlers -> db -> publishEvents -> eventHandlers
    // const eventHandlerMap = configureFeatureEventhandlers(() => ({ context: scope.context, db }))
    // const publishEvents = publishEventsUnconfigured(eventHandlerMap)
    // const eventHandler = new DomainEventHandler(
    //   publishEvents,
    //   postCommitHandlers => executePostCommitHandlers(postCommitHandlers, setupChildContext),
    // )
    // const db = new DiskDBContext(eventHandler)

    const enhancedScope = Object.assign(scope) // , { db }
    return enhancedScope
  }

  const usecases = {
    feature: configureFeatureUsecases(createScopedDependencies),
  }

  return {
    bindLogger,
    ns,
    setDependencyScope,
    usecases,
  }
}

const namespace = 'fw-itp-service'

export default createRoot

interface ScopedDependencies { context: RequestContextBase, db: any }

const configureFeatureUsecases = (
  createScopedDependencies: () => ScopedDependencies,
) => ({
  get: generateConfiguredHandler('get', get, createScopedDependencies),

  create: generateConfiguredHandler('create', create, createScopedDependencies, true),
})
