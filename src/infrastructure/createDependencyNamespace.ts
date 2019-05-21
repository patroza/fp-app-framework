import chalk from 'chalk'
import { createNamespace, getNamespace } from 'cls-hooked'
import format from 'date-fns/format'
import { EventEmitter } from 'events'
import { setFunctionName } from 'fp-app-framework/utils'
import { generateShortUuid } from '../utils/generateUuid'
import { UnitOfWork } from './context.base'
import DomainEventHandler, { executePostCommitHandlersKey } from './domainEventHandler'
import executePostCommitHandlers from './executePostCommitHandlers'
import {
  getHandlerImpl, getRegisteredRequestAndEventHandlers,
  RequestContextBase,
} from './mediator'
import publish from './mediator/publish'
import request from './mediator/request'
import SimpleContainer, { DependencyScope } from './SimpleContainer'

export default function createDependencyNamespace(namespace: string, requestScopeKey: RequestContextBase, uowKey: UnitOfWork) {
  const ns = createNamespace(namespace)
  const dependencyScopeKey = 'dependencyScope'
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)

  const container = new SimpleContainer(getDependencyScope, setDependencyScope)
  const resolveDependencies = resolveDependenciesImpl(container)
  const create = ([impl, key, deps]: any) => {
    const resolved = impl(resolveDependencies(deps))
    setFunctionName(resolved, key.name)
    return resolved
  }

  const getRequestHandler = getHandlerImpl(container, uowKey)

  const bindLogger = (fnc: (...args2: any[]) => void) => (...args: any[]) => {
    const context = container.tryGetF(requestScopeKey)
    const datetime = new Date()
    const timestamp = format(datetime, 'YYYY-MM-DD HH:mm:ss')
    const id = context ? (context.correllationId === context.id
      ? context.id
      : `${context.id} (${context.correllationId})`)
      : 'root context'
    return fnc(`${chalk.green(timestamp)} ${chalk.blue(`[${id}]`)}`, ...args)
  }

  const setupChildContext = <T>(cb: () => Promise<T>) =>
    ns.runPromise(() => {
      let context = container.getF(requestScopeKey)
      const { correllationId, id } = context
      container.createScope()
      context = container.getF(requestScopeKey)
      Object.assign(context, { correllationId: correllationId || id })

      return cb()
    })

  const setupRootContext = <T>(cb: (context: RequestContextBase, bindEmitter: (typeof ns)['bindEmitter']) => Promise<T>) =>
    ns.runPromise(() => {
      container.createScope()
      return cb(
        container.getF(requestScopeKey),
        (emitter: EventEmitter) => ns.bindEmitter(emitter),
      )
    })

  const publish2 = publish(evt => (handlerMap.get(evt.constructor) || []).map(x => container.getF(x)))
  container.registerScopedC(
    DomainEventHandler,
    () => new DomainEventHandler(publish2, container.getF(executePostCommitHandlersKey)),
  )
  container.registerScopedF(requestScopeKey, () => { const id = generateShortUuid(); return { id, correllationId: id } })
  getRegisteredRequestAndEventHandlers().forEach(([_, v]) => container.registerScopedF(v[1], () => create(v)))

  const request2 = request(getRequestHandler)

  container.registerSingletonF(executePostCommitHandlersKey, () => executePostCommitHandlers({ setupChildContext }))

  return {
    bindLogger,
    container,
    setupRootContext,

    request: request2,
  }
}

const resolveDependenciesImpl = (container: SimpleContainer) => <TDependencies>(deps: TDependencies) => Object.keys(deps).reduce((prev, cur) => {
  const dAny = deps as any
  const key = dAny[cur]
  const pAny = prev as any
  pAny[cur] = container.getF(key)
  return prev
}, {} as TDependencies)

const registerEventHandler = (event: any, handler: any) => {
  const current = handlerMap.get(event) || []
  current.push(handler)
  handlerMap.set(event, current)
}

// tslint:disable-next-line:ban-types
const handlerMap = new Map<any, any[]>() // Array<readonly [Function, Function, {}]>

export { registerEventHandler }
