import { createNamespace, getNamespace, Namespace } from 'cls-hooked'
import { benchLog, logger } from '../utils'
import { generateShortUuid } from '../utils/generateUuid'
import { flatMap, flatTee, liftType, mapErr, PipeFunction } from '../utils/neverthrow-extensions'
import { UnitOfWork } from './context.base'
import { DbError } from './errors'
import { RequestContextBase } from './misc'

export const createDependencyNamespace = (namespace: string) => {
  const ns = createNamespace(namespace)

  type DependencyScope<T extends RequestContextBase = RequestContextBase> = { context: T } & { [key: string]: any }
  const dependencyScopeKey = 'dependencyScope'
  const getDependencyScope = (): DependencyScope => getNamespace(namespace).get(dependencyScopeKey)
  const setDependencyScope = (scope: DependencyScope) => getNamespace(namespace).set(dependencyScopeKey, scope)

  const setupChildContext = <T>(cb: () => Promise<T>) =>
    ns.runPromise(() => {
      const scope = getDependencyScope()
      if (!scope) { throw new Error('No namespace/dependencyScope found, are we in a test runner?') }

      // we pass in correllation id, but not main id
      const id = generateShortUuid()
      const { context: { correllationId = id } } = scope
      setDependencyScope({ context: { correllationId, id } })

      return cb()
    })

  return {
    getDependencyScope,
    ns,
    setDependencyScope,
    setupChildContext,
  }
}

export const bindNamespace = <TRet>(next: () => Promise<TRet>, ns: Namespace) =>
  new Promise<TRet>(ns.bind((resolve: any, reject: any) => next().then(resolve).catch(reject), ns.createContext()))

export const generateConfiguredHandler = <TInput, TDependencies extends { db: any }, TOutput, TErr>(
  // Have to specify name as we don't use classes to retrieve the name from
  name: string,
  func: (deps: TDependencies) => PipeFunction<TInput, TOutput, TErr>,
  resolveDependencies: () => TDependencies,
  isCommand = false,
): NamedRequestHandler<TInput, TOutput, TErr | DbError> => {
  const requestType = isCommand ? 'Command' : 'Query'
  const prefix = `${name} ${requestType}`
  const handler = (input: TInput) => benchLog(async () => {
    const deps = resolveDependencies()
    const execFunc = func(deps)
    logger.log(`${prefix} input`, input)

    if (isCommand) {
      const writableDb = deps.db as any as UnitOfWork
      const result = await execFunc(input)
        .pipe(
          mapErr(liftType<TErr | DbError>()),
          flatMap(flatTee(() => writableDb.save())),
        )
      logger.log(`${prefix} result`, result)
      return result
    } else {
      const result = await execFunc(input)
      logger.log(`${prefix} result`, result)
      return result
    }
  }, prefix)
  handler.$name = name
  handler.$isCommand = isCommand
  return handler
}

type NamedRequestHandler<TInput, TOutput, TErr> = PipeFunction<TInput, TOutput, TErr> & { $name: string, $isCommand: boolean }
