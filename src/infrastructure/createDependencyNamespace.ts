import chalk from 'chalk'
import { createNamespace, getNamespace } from 'cls-hooked'
import format from 'date-fns/format'
import { EventEmitter } from 'events'
import { generateShortUuid } from '../utils/generateUuid'
import { PipeFunction } from '../utils/neverthrow-extensions'
import { UnitOfWork } from './context.base'
import DomainEventHandler, { executePostCommitHandlersKey, publishEventsKey } from './domainEventHandler'
import executePostCommitHandlers from './executePostCommitHandlers'
import { RequestContextBase } from './misc'
import publishEvents, { publishType } from './publishEvents'
import {
  getHandlerImpl, getRegisteredEventHandlers, getRegisteredRequestAndEventHandlers, requestType, UsecaseWithDependencies,
} from './requestHandlers'
import SimpleContainer, { DependencyScope } from './SimpleContainer'

export default function createDependencyNamespace(namespace: string, requestScopeKey: RequestContextBase, uowKey: UnitOfWork) {
  const ns = createNamespace(namespace)
  const dependencyScopeKey = 'dependencyScope'
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)

  const container = new SimpleContainer(getDependencyScope, setDependencyScope)
  const resolveDependencies = resolveDependenciesImpl(container)
  const create = ([impl, _, deps]: any) => impl(resolveDependencies(deps))

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

  container.registerScopedF(requestScopeKey, () => {
    const id = generateShortUuid()
    return { id, correllationId: id }
  })

  container.registerSingletonF(executePostCommitHandlersKey, () => executePostCommitHandlers({ setupChildContext }))
  container.registerSingletonF(publishEventsKey, () => publishEvents(new Map(getRegisteredEventHandlers()), publish))
  container.registerSingletonC(
    DomainEventHandler,
    () => new DomainEventHandler(container.getF(publishEventsKey), container.getF(executePostCommitHandlersKey)),
  )

  getRegisteredRequestAndEventHandlers().forEach(([_, v]) => container.registerScopedF(v[1], () => create(v)))

  const request: requestType = <TInput, TOutput, TError>(requestHandler: UsecaseWithDependencies<any, TInput, TOutput, TError>, input: TInput) => {
    const handler = getRequestHandler(requestHandler)
    return handler(input)
  }

  const publish: publishType = <TInput, TOutput, TError>(eventHandler: PipeFunction<TInput, TOutput, TError>, event: TInput) => {
    const handler = container.getF(eventHandler)
    return handler(event)
  }

  return {
    bindLogger,
    container,
    setupRootContext,

    request,
  }
}

const resolveDependenciesImpl = (container: SimpleContainer) => <TDependencies>(deps: TDependencies) => Object.keys(deps).reduce((prev, cur) => {
  const dAny = deps as any
  const key = dAny[cur]
  const pAny = prev as any
  pAny[cur] = container.getF(key)
  return prev
}, {} as TDependencies)
