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

export const createDependencyNamespace = (namespace: string, requestScopeKey: RequestContextBase, uowKey: UnitOfWork) => {
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
    return generateConfiguredHandler(name, () => container.getF(usecaseHandler[1]), getUnitOfWork, type === 'COMMAND')
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

type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr | DbError> & { $name: string, $isCommand: boolean }

const generateConfiguredHandler = <TInput, TOutput, TErr>(
  // Have to specify name as we don't use classes to retrieve the name from
  name: string,
  getFunc: () => PipeFunction<TInput, TOutput, TErr>,
  getUnitOfWork: () => UnitOfWork,
  isCommand = false,
): NamedRequestHandler<TInput, TOutput, TErr> => {
  const requestType = isCommand ? 'Command' : 'Query'
  const prefix = `${name} ${requestType}`

  const handler = (input: TInput) => benchLog(async () => {
    logger.log(`${prefix} input`, input)
    const execFunc = getFunc()

    if (!isCommand) {
      const result = await execFunc(input)
      logger.log(`${prefix} result`, result)
      return result
    }

    const unitOfWork = getUnitOfWork()
    const savedResult = await execFunc(input)
      .pipe(
        mapErr(liftType<TErr | DbError>()),
        flatMap(flatTee(unitOfWork.save)),
      )
    logger.log(`${prefix} result`, savedResult)
    return savedResult
  }, prefix)

  handler.$name = name
  handler.$isCommand = isCommand

  return handler
}

const resolveDependenciesImpl = (container: SimpleContainer) => <TDependencies>(deps: TDependencies) => Object.keys(deps).reduce((prev, cur) => {
  const dAny = deps as any
  const key = dAny[cur]
  const pAny = prev as any
  pAny[cur] = container.getF(key)
  return prev
}, {} as TDependencies)
