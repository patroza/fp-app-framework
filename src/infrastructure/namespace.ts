import chalk from 'chalk'
import { createNamespace, getNamespace } from 'cls-hooked'
import format from 'date-fns/format'
import { EventEmitter } from 'events'
import { benchLog, logger } from '../utils'
import { generateShortUuid } from '../utils/generateUuid'
import { flatMap, flatTee, liftType, mapErr, PipeFunction } from '../utils/neverthrow-extensions'
import { UnitOfWork } from './context.base'
import { DbError } from './errors'
import { RequestContextBase } from './misc'
import { getRegisteredHandlers, UsecaseHandlerTuple } from './requestHandlers'
import SimpleContainer, { DependencyScope } from './SimpleContainer'

export function createDependencyNamespace(namespace: string, requestScopeKey: RequestContextBase, uowKey: UnitOfWork) {
  const ns = createNamespace(namespace)
  const dependencyScopeKey = 'dependencyScope'
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)

  const container = new SimpleContainer(getDependencyScope, setDependencyScope)
  const resolveDependencies = resolveDependenciesImpl(container)
  const create = ([impl, _, deps]: any) => impl(resolveDependencies(deps))

  const getUnitOfWork = () => container.getF(uowKey)
  const getHandler: getHandlerType = usecaseHandler => {
    const { name, type } = usecaseHandler[3]

    // These execute in reverse order
    const decorators = [
      uowDecorator(getUnitOfWork),
      loggingDecorator(),
    ]
    return generateConfiguredHandler(
      name,
      () => container.getF(usecaseHandler[1]),
      decorators,
      type === 'COMMAND',
    )
  }

  container.registerScopedF(requestScopeKey, () => {
    const id = generateShortUuid()
    return { id, correllationId: id }
  })

  getRegisteredHandlers().forEach(([_, v]) => container.registerScopedF(v[1], () => create(v)))

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

  return {
    bindLogger,
    container,
    getHandler,
    setupChildContext,
    setupRootContext,
  }
}

// tslint:disable-next-line:max-line-length
export type getHandlerType = <TDependencies, TInput, TOutput, TError>(usecaseHandler: UsecaseHandlerTuple<TDependencies, TInput, TOutput, TError>) => NamedRequestHandler<TInput, TOutput, TError>

type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr | DbError> & { name: string, isCommand: boolean }

const generateConfiguredHandler = <TInput, TOutput, TErr>(
  // Have to specify name as we don't use classes to retrieve the name from
  name: string,
  getFunc: () => PipeFunction<TInput, TOutput, TErr>,
  decorators: any[],
  isCommand = false,
): NamedRequestHandler<TInput, TOutput, TErr> => {
  let handler = (input: TInput) => {
    const execFunc = getFunc()
    return execFunc(input)
  }

  // TODO: manage way how we don't have to apply this to every decorator.
  Object.defineProperty(handler, 'name', { value: name })
  let handlerAny = handler as any
  handlerAny.isCommand = isCommand

  decorators.forEach(x => {
    handler = x(handler)
    Object.defineProperty(handler, 'name', { value: name })
    handlerAny = handler as any
    handlerAny.isCommand = isCommand
  })

  return handler as any
}

const loggingDecorator = (
) => <TInput, TOutput, TErr>(handler: NamedRequestHandler<TInput, TOutput, TErr>) => (
  input: TInput,
) => benchLog(async () => {
  const requestType = handler.isCommand ? 'Command' : 'Query'
  const prefix = `${handler.name} ${requestType}`
  logger.log(`${prefix} input`, input)
  const result = await handler(input)
  logger.log(`${prefix} result`, result)
  return result
})

const uowDecorator = (
  getUnitOfWork: () => UnitOfWork,
) => <TInput, TOutput, TErr>(handler: NamedRequestHandler<TInput, TOutput, TErr>) => (
  input: TInput,
) => {
  if (!handler.isCommand) {
    return handler(input)
  }

  const unitOfWork = getUnitOfWork()
  return handler(input)
    .pipe(
      mapErr(liftType<TErr | DbError>()),
      flatMap(flatTee(unitOfWork.save)),
    )
}

const resolveDependenciesImpl = (container: SimpleContainer) => <TDependencies>(deps: TDependencies) => Object.keys(deps).reduce((prev, cur) => {
  const dAny = deps as any
  const key = dAny[cur]
  const pAny = prev as any
  pAny[cur] = container.getF(key)
  return prev
}, {} as TDependencies)
