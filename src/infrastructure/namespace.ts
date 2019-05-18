import { ReadonlyContext, RequestContextKey } from '@/ITP/usecases/types'
import { createNamespace, getNamespace, Namespace } from 'cls-hooked'
import { benchLog, logger } from '../utils'
import { generateShortUuid } from '../utils/generateUuid'
import { flatMap, flatTee, liftType, mapErr, PipeFunction } from '../utils/neverthrow-extensions'
import { UnitOfWork } from './context.base'
import { DbError } from './errors'
import { RequestContextBase } from './misc'
import SimpleContainer, { DependencyScope } from './SimpleContainer'

export const createDependencyNamespace = (namespace: string) => {
  const ns = createNamespace(namespace)
  const dependencyScopeKey = 'dependencyScope'
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)
  const container = new SimpleContainer(getDependencyScope, setDependencyScope)
  container.registerScopedF<RequestContextBase>(RequestContextKey, () => {
    const id = generateShortUuid()
    return { id, correllationId: id }
  })

  const bindLogger = (fnc: (...args2: any[]) => void) => (...args: any[]) => {
    const context = container.tryGetF(RequestContextKey)
    // tslint:disable-next-line:no-console
    if (!context) { return fnc('[root context]', ...args) }
    // tslint:disable-next-line:no-console
    const id = context.correllationId === context.id
      ? context.id
      : `${context.id} (${context.correllationId})`
    return fnc(`[${id}]`, ...args)
  }

  const setupChildContext = <T>(cb: () => Promise<T>) =>
    ns.runPromise(() => {
      let context = container.getF(RequestContextKey)
      const { correllationId, id } = context
      container.createScope()
      context = container.getF(RequestContextKey)
      Object.assign(context, { correllationId: correllationId || id })

      return cb()
    })

  const setupRootContext = <T>(cb: () => Promise<T>) =>
    ns.runPromise(() => {
      container.createScope()
      return cb()
    })

  return {
    bindLogger,
    container,
    ns,
    setupChildContext,
    setupRootContext,
  }
}

export const bindNamespace = <TRet>(next: () => Promise<TRet>, ns: Namespace) =>
  new Promise<TRet>(ns.bind((resolve: any, reject: any) => next().then(resolve).catch(reject), ns.createContext()))

export const generateConfiguredHandler = <TInput, TOutput, TErr>(
  // Have to specify name as we don't use classes to retrieve the name from
  name: string,
  getFunc: () => PipeFunction<TInput, TOutput, TErr>,
  getDB: () => ReadonlyContext,
  isCommand = false,
): NamedRequestHandler<TInput, TOutput, TErr | DbError> => {
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

    const db = getDB()
    const writableDb = db as UnitOfWork
    const savedResult = await execFunc(input)
      .pipe(
        mapErr(liftType<TErr | DbError>()),
        flatMap(flatTee(writableDb.save)),
      )
    logger.log(`${prefix} result`, savedResult)
    return savedResult
  }, prefix)

  handler.$name = name
  handler.$isCommand = isCommand

  return handler
}

export type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr> & { $name: string, $isCommand: boolean }
