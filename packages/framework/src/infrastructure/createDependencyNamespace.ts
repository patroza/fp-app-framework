import chalk from "chalk"
import { createNamespace, getNamespace } from "cls-hooked"
import format from "date-fns/format"
import { EventEmitter } from "events"
import Event from "../event"
import {
  Constructor,
  generateShortUuid,
  getLogger,
  removeElement,
  using,
} from "../utils"
import { loggingDecorator, uowDecorator } from "./decorators"
import DomainEventHandler, { executePostCommitHandlersKey } from "./domainEventHandler"
import executePostCommitHandlers from "./executePostCommitHandlers"
import {
  getRegisteredRequestAndEventHandlers,
  publish,
  request,
  RequestContextBase,
  requestInNewScopeKey,
  requestInNewScopeType,
  requestKey,
  requestType,
  resolveEventKey,
} from "./mediator"
import { processReceivedEvent } from "./pubsub"
import SimpleContainer, { DependencyScope, factoryOf, Key } from "./SimpleContainer"
import { Either } from "fp-ts/lib/Either"

const logger = getLogger("registry")

export default function createDependencyNamespace(
  namespace: string,
  requestScopeKey: Key<RequestContextBase>,
) {
  const ns = createNamespace(namespace)
  const getDependencyScope = (): DependencyScope =>
    getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) =>
    getNamespace(namespace).set(dependencyScopeKey, scope)
  const hasDependencyScope = () => getDependencyScope() != null

  interface LoggingScope {
    items: {}[]
  }

  const container = new SimpleContainer(getDependencyScope, setDependencyScope)

  const getLoggingScope = (): LoggingScope =>
    getNamespace(namespace).get(loggingScopeKey)

  const addToLoggingContext = (item: { [key: string]: any }) => {
    getLoggingScope().items.push(item)
    return {
      dispose: () => removeElement(getLoggingScope().items, item),
    }
  }

  const bindLogger = (fnc: (...args2: any[]) => void) => (...args: any[]) => {
    const context = hasDependencyScope() && container.getO(requestScopeKey)
    const datetime = new Date()
    const timestamp = format(datetime, "YYYY-MM-DD HH:mm:ss")
    const scope = getLoggingScope()
    const items =
      scope && scope.items.reduce((prev, cur) => ({ ...prev, ...cur }), {} as any)
    const id = context
      ? context.correllationId === context.id
        ? context.id
        : `${context.id} (${context.correllationId})`
      : "root context"
    return fnc(
      `${chalk.green(timestamp)} ${chalk.blue(`[${id}]`)}`,
      ...args.concat(items && Object.keys(items).length ? [items] : []),
    )
  }

  const setupChildContext = <T>(cb: () => Promise<T>) =>
    ns.runPromise(() => {
      const currentContext = container.getO(requestScopeKey)
      const { correllationId, id } = currentContext
      return using(container.createScope(), () => {
        const context = container.getO(requestScopeKey)
        Object.assign(context, { correllationId: correllationId || id })
        logger.debug(chalk.magenta("Created child context"))
        return cb()
      })
    })

  const setupRequestContext = <T>(
    cb: (
      context: RequestContextBase,
      bindEmitter: typeof ns["bindEmitter"],
    ) => Promise<T>,
  ) =>
    ns.runPromise(() =>
      using(container.createScope(), () => {
        getNamespace(namespace).set(loggingScopeKey, { items: [] })
        logger.debug(chalk.magenta("Created request context"))
        return cb(container.getO(requestScopeKey), (emitter: EventEmitter) =>
          ns.bindEmitter(emitter),
        )
      }),
    )

  const publishDomainEventHandler = publish(evt =>
    (domainHandlerMap.get(evt.constructor) || []).map(x => container.getF(x)),
  )
  const getIntegrationEventHandlers = (evt: Event) =>
    integrationHandlerMap.get(evt.constructor)
  const publishIntegrationEventHandler = publish(evt =>
    (integrationHandlerMap.get(evt.constructor) || []).map(x => container.getF(x)),
  )
  container.registerScopedC(
    DomainEventHandler,
    () =>
      new DomainEventHandler(
        publishDomainEventHandler,
        getIntegrationEventHandlers,
        container.getF(executePostCommitHandlersKey),
      ),
  )
  container.registerScopedO(requestScopeKey, () => {
    const id = generateShortUuid()
    return { id, correllationId: id }
  })
  getRegisteredRequestAndEventHandlers().forEach(h =>
    container.registerScopedConcrete(h),
  )

  container.registerScopedConcrete(uowDecorator)
  container.registerSingletonConcrete(loggingDecorator)
  container.registerDecorator(requestKey, uowDecorator, loggingDecorator)

  container.registerSingletonF(
    executePostCommitHandlersKey,
    factoryOf(executePostCommitHandlers, i =>
      i({ executeIntegrationEvent: container.getF(requestInNewScopeKey) }),
    ),
  )

  const publishInNewContext = (evt: string, requestId: string) =>
    setupRequestContext(context => {
      const correllationId = requestId || context.id
      Object.assign(context, { correllationId })

      return processReceivedEvent({
        publish: publishIntegrationEventHandler,
        resolveEvent: container.getF(resolveEventKey),
      })(evt)
    })

  const requestInNewContext: requestInNewScopeType = <TInput, TOutput>(
    key: any,
    evt: any,
  ) => () =>
    setupChildContext<Either<TInput, TOutput>>(
      () => container.getF(requestKey)(key, evt)() as any,
    )
  container.registerSingletonF(
    requestKey,
    factoryOf(request, i => i(key => container.getConcrete(key))),
  )
  container.registerInstanceF(requestInNewScopeKey, requestInNewContext)

  // In a perfect world, the decorators also enhance the type here
  // however they also apply different behavior depending on the request.
  // ie the uowDecorator, if a command, will call save on the uow and thus should
  // extend the error with | DbError...
  const request2: requestType = (key, input) => container.getF(requestKey)(key, input)

  return {
    addToLoggingContext,
    bindLogger,
    container,
    setupRequestContext,

    publishInNewContext,
    request: request2,
  }
}

const dependencyScopeKey = "dependencyScope"
const loggingScopeKey = "loggingScope"

const registerDomainEventHandler = (event: Constructor<any>, handler: any) => {
  logger.debug(chalk.magenta(`Registered Domain event handler for ${event.name}`))
  const current = domainHandlerMap.get(event) || []
  current.push(handler)
  domainHandlerMap.set(event, current)
}

const registerIntegrationEventHandler = (event: Constructor<any>, handler: any) => {
  logger.debug(chalk.magenta(`Registered Integration event handler for ${event.name}`))
  const current = integrationHandlerMap.get(event) || []
  current.push(handler)
  integrationHandlerMap.set(event, current)
}

// tslint:disable-next-line:ban-types
const domainHandlerMap = new Map<any, any[]>() // Array<readonly [Function, Function, {}]>
const integrationHandlerMap = new Map<any, any[]>() // Array<readonly [Function, Function, {}]>

export { registerDomainEventHandler, registerIntegrationEventHandler }
