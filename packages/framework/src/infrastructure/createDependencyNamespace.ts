import chalk from "chalk"
import { createNamespace, getNamespace } from "cls-hooked"
import format from "date-fns/format"
import { EventEmitter } from "events"
import { Constructor, logger, setFunctionName } from "../utils"
import { generateShortUuid } from "../utils/generateUuid"
import { UnitOfWork } from "./context.base"
import { loggingDecorator, uowDecorator } from "./decorators"
import DomainEventHandler, { executePostCommitHandlersKey } from "./domainEventHandler"
import executePostCommitHandlers from "./executePostCommitHandlers"
import {
  getRegisteredRequestAndEventHandlers,
  NamedHandlerWithDependencies, publish, request, RequestContextBase, requestInNewScopeKey, requestInNewScopeType, requestKey, requestType,
} from "./mediator"
import SimpleContainer, { DependencyScope, generateKey, Key } from "./SimpleContainer"

export default function createDependencyNamespace(namespace: string, requestScopeKey: Key<RequestContextBase>, uowKey: Key<UnitOfWork>) {
  const ns = createNamespace(namespace)
  const dependencyScopeKey = "dependencyScope"
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)

  const container = new SimpleContainer(getDependencyScope, setDependencyScope)
  const resolveDependencies = resolveDependenciesImpl(container)
  const create = (h: NamedHandlerWithDependencies<any, any, any, any>) => {
    const resolved = h(resolveDependencies(h.deps))
    setFunctionName(resolved, h.name)
    return resolved
  }

  const bindLogger = (fnc: (...args2: any[]) => void) => (...args: any[]) => {
    const context = container.tryGetO(requestScopeKey)
    const datetime = new Date()
    const timestamp = format(datetime, "YYYY-MM-DD HH:mm:ss")
    const id = context ? (context.correllationId === context.id
      ? context.id
      : `${context.id} (${context.correllationId})`)
      : "root context"
    return fnc(`${chalk.green(timestamp)} ${chalk.blue(`[${id}]`)}`, ...args)
  }

  const setupChildContext = <T>(cb: () => Promise<T>) =>
    ns.runPromise(() => {
      let context = container.getO(requestScopeKey)
      const { correllationId, id } = context
      container.createScope()
      context = container.getO(requestScopeKey)
      Object.assign(context, { correllationId: correllationId || id })

      return cb()
    })

  const setupRootContext = <T>(cb: (context: RequestContextBase, bindEmitter: (typeof ns)["bindEmitter"]) => Promise<T>) =>
    ns.runPromise(() => {
      container.createScope()
      return cb(
        container.getO(requestScopeKey),
        (emitter: EventEmitter) => ns.bindEmitter(emitter),
      )
    })

  const publishDomainEventHandler = publish(evt => (domainHandlerMap.get(evt.constructor) || []).map(x => container.getF(x)))
  // const publishIntegrationEventHandler = publish(evt => (integrationHandlerMap.get(evt.constructor) || []).map(x => container.getF(x)))
  container.registerScopedC(
    DomainEventHandler,
    () => new DomainEventHandler(
      publishDomainEventHandler,
      evt => integrationHandlerMap.get(evt.constructor),
      container.getF(executePostCommitHandlersKey),
    ),
  )
  container.registerScopedO(requestScopeKey, () => { const id = generateShortUuid(); return { id, correllationId: id } })
  getRegisteredRequestAndEventHandlers().forEach(h => container.registerScopedConcrete(h, () => create(h)))

  const uowDecoratorKey = generateKey<ReturnType<typeof uowDecorator>>()
  const loggingDecoratorKey = generateKey<ReturnType<typeof loggingDecorator>>()

  container.registerScopedF(uowDecoratorKey, () => uowDecorator(container.getO(uowKey)))
  container.registerSingletonF(loggingDecoratorKey, () => loggingDecorator())
  container.registerDecorator(requestKey, uowDecoratorKey, loggingDecoratorKey)

  container.registerSingletonF(
    executePostCommitHandlersKey,
    () => executePostCommitHandlers({ executeIntegrationEvent: container.getF(requestInNewScopeKey) }),
  )

  const requestInNewContext: requestInNewScopeType = (key: any, evt: any) =>
    setupChildContext(() => container.getF(requestKey)(key, evt))
  container.registerSingletonF(requestKey, () => request(key => container.getConcrete(key)))
  container.registerSingletonF(requestInNewScopeKey, () => requestInNewContext)

  // In a perfect world, the decorators also enhance the type here
  // however they also apply different behavior depending on the request.
  // ie the uowDecorator, if a command, will call save on the uow and thus should
  // extend the error with | DbError...
  const request2: requestType = (key, input) => container.getF(requestKey)(key, input)

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

const registerDomainEventHandler = (event: Constructor<any>, handler: any) => {
  logger.debug(`Registered Domain event handler for ${event.name}`)
  const current = domainHandlerMap.get(event) || []
  current.push(handler)
  domainHandlerMap.set(event, current)
}

const registerIntegrationEventHandler = (event: Constructor<any>, handler: any) => {
  logger.debug(`Registered Integration event handler for ${event.name}`)
  const current = integrationHandlerMap.get(event) || []
  current.push(handler)
  integrationHandlerMap.set(event, current)
}

// tslint:disable-next-line:ban-types
const domainHandlerMap = new Map<any, any[]>() // Array<readonly [Function, Function, {}]>
const integrationHandlerMap = new Map<any, any[]>() // Array<readonly [Function, Function, {}]>

export { registerDomainEventHandler, registerIntegrationEventHandler }
