import chalk from "chalk"
import { createNamespace, getNamespace } from "cls-hooked"
import format from "date-fns/format"
import { EventEmitter } from "events"
import { setFunctionName } from "../utils"
import { generateShortUuid } from "../utils/generateUuid"
import { UnitOfWork } from "./context.base"
import { loggingDecorator, uowDecorator } from "./decorators"
import DomainEventHandler, { executePostCommitHandlersKey } from "./domainEventHandler"
import executePostCommitHandlers from "./executePostCommitHandlers"
import {
  getHandlerKey, getRegisteredRequestAndEventHandlers,
  publish, request, RequestContextBase, requestKey, requestType,
} from "./mediator"
import SimpleContainer, { DependencyScope, generateKey } from "./SimpleContainer"

export default function createDependencyNamespace(namespace: string, requestScopeKey: RequestContextBase, uowKey: UnitOfWork) {
  const ns = createNamespace(namespace)
  const dependencyScopeKey = "dependencyScope"
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)

  const container = new SimpleContainer(getDependencyScope, setDependencyScope)
  const resolveDependencies = resolveDependenciesImpl(container)
  const create = ([impl, key, deps]: any) => {
    const resolved = impl(resolveDependencies(deps))
    setFunctionName(resolved, key.name)
    return resolved
  }

  const bindLogger = (fnc: (...args2: any[]) => void) => (...args: any[]) => {
    const context = container.tryGetF(requestScopeKey)
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
      let context = container.getF(requestScopeKey)
      const { correllationId, id } = context
      container.createScope()
      context = container.getF(requestScopeKey)
      Object.assign(context, { correllationId: correllationId || id })

      return cb()
    })

  const setupRootContext = <T>(cb: (context: RequestContextBase, bindEmitter: (typeof ns)["bindEmitter"]) => Promise<T>) =>
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
  container.registerScopedO(requestScopeKey, () => { const id = generateShortUuid(); return { id, correllationId: id } })
  getRegisteredRequestAndEventHandlers().forEach(([, v]) => container.registerScopedF(v[1], () => create(v)))

  const uowDecoratorKey = generateKey<ReturnType<typeof uowDecorator>>()
  const loggingDecoratorKey = generateKey<ReturnType<typeof loggingDecorator>>()

  container.registerScopedF(uowDecoratorKey, () => uowDecorator(container.getF(uowKey)))
  container.registerSingletonF(loggingDecoratorKey, () => loggingDecorator())
  container.registerDecorator(requestKey, uowDecoratorKey, loggingDecoratorKey)
  container.registerSingletonF(executePostCommitHandlersKey, () => executePostCommitHandlers({ setupChildContext }))
  container.registerSingletonF(requestKey, () => request(key => container.getF(getHandlerKey(key))))

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

const registerEventHandler = (event: any, handler: any) => {
  const current = handlerMap.get(event) || []
  current.push(handler)
  handlerMap.set(event, current)
}

// tslint:disable-next-line:ban-types
const handlerMap = new Map<any, any[]>() // Array<readonly [Function, Function, {}]>

export { registerEventHandler }