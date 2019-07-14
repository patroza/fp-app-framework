// export * from "fp-ts/lib/Either"

import { Either, Right, Left, left, right } from "fp-ts/lib/Either"
import { map } from "fp-ts/lib/TaskEither"
import { pipe as pipeOriginal } from "fp-ts/lib/pipeable"

import * as E from "fp-ts/lib/Either"
import * as T from "fp-ts/lib/Task"
import * as TE from "fp-ts/lib/TaskEither"

export { E, T, TE }

export const result = TE.taskEither
export type AsyncResult<TSuccess, TError> = TaskEither<TError, TSuccess>
export type Result<TSuccess, TError> = Either<TError, TSuccess>
export const err = <TSuccess = never, TError = never>(e: TError): Result<TSuccess, TError> => left<TError, TSuccess>(e)
export const ok = <TSuccess = never, TError = never>(a: TSuccess): Result<TSuccess, TError> =>
  right<TError, TSuccess>(a)
export type Ok<TSuccess> = Task<Right<TSuccess>>
export type Err<TErr> = Task<Left<TErr>>
const compose = pipeOriginal

export { map, compose }

import { flatten, zip } from "lodash"
import { TaskEither } from "fp-ts/lib/TaskEither"
import { Task } from "fp-ts/lib/Task"
// useful tools for .pipe( continuations
export const mapStatic = <TCurrent, TNew>(value: TNew) => map<TCurrent, TNew>(toValue(value))
export const toValue = <TNew>(value: TNew) => () => value
export const toVoid = toValue<void>(void 0)
// export const endResult = mapStatic<void>(void 0)

// TODO: Should come with flatMap already wrapped aroun it
export function flatTee<T, T2 extends T, TDontCare, E>(f: PipeFunction<T2, TDontCare, E>): PipeFunction<T, T, E>
export function flatTee<T, T2 extends T, TDontCare, E>(f: PipeFunction2<T2, TDontCare, E>): (input: T) => Result<T, E>
export function flatTee(f: any) {
  return (input: any) => {
    const r = f(input)
    if (Promise.resolve(r) === r) {
      return r.then((x: any) => intTee(x, input))
    } else {
      return intTee(r, input)
    }
  }
}

// TODO: Should come with map already wrapped aroun it
export function tee<T, T2 extends T, TDontCare, E>(f: (x: T2) => Promise<TDontCare>): (input: T) => Promise<T>
export function tee<T, T2 extends T, TDontCare, E>(f: (x: T2) => TDontCare): (input: T) => T
export function tee(f: any) {
  return (input: any) => {
    const r = f(input)
    if (Promise.resolve(r) === r) {
      return r.then(() => input)
    } else {
      return input
    }
  }
}
const intTee = (r: any, input: any) => (r._tag === "Right" ? ok(input) : err(r.left))

const intToTup = (r: any, input: any) => (r._tag === "Right" ? ok([r.right, input]) : err(r.left))

// Easily pass input -> (input -> output) -> [input, output]
export function TEtoTup<TInput, TInput2 extends TInput, T, EMap>(
  f: (x: TInput2) => AsyncResult<T, EMap>,
): <E>(input: TInput) => AsyncResult<readonly [T, TInput], EMap>
export function TEtoTup(f: any) {
  return (input: any) => async () => {
    const r = await f(input)()
    return intToTup(r, input)
  }
}

export function EtoTup<TInput, TInput2 extends TInput, T, EMap>(
  f: (x: TInput2) => Result<T, EMap>,
): <E>(input: TInput) => Result<readonly [T, TInput], E>
export function EtoTup(f: any) {
  return (input: any) => {
    const r = f(input)
    return intToTup(r, input)
  }
}

// export function ifErrorflatMap<T, TNew, E>(defaultVal: (e: E) => AsyncResult<TNew, E>): (result: Result<T, E>) => AsyncResult<TNew, E>;
export function ifErrorflatMap<T, TNew, E>(
  defaultVal: (e: E) => Result<TNew, E>,
): (result: Result<T, E>) => Result<TNew, E>
export function ifErrorflatMap(defaultVal: any) {
  return (result: Result<any, any>) => {
    if (result._tag === "Right") {
      return result
    } else {
      return defaultVal(result.left)
    }
  }
}

// export function ifError<T, E, TNew>(defaultVal: (e: E) => Promise<TNew>): (result: Result<T, E>) => AsyncResult<TNew, E>;
export function ifError<T, E, TNew>(defaultVal: (e: E) => TNew): (result: Result<T, E>) => Result<TNew, E>
export function ifError(defaultVal: any) {
  return (result: any) => {
    if (result._tag === "Right") {
      return result
    }
    return ok(defaultVal(result.left))
  }
}

export const joinError = <T>(result: Result<T, string[]>) =>
  pipe(
    result,
    TE.mapLeft(x => x.join("\n")),
  )

export function resultTuple<T, T2, E>(r1: Result<T, E>, r2: Result<T2, E>): Result<readonly [T, T2], E[]>
export function resultTuple<T, T2, T3, E>(
  r1: Result<T, E>,
  r2: Result<T2, E>,
  r3: Result<T3, E>,
): Result<readonly [T, T2, T3], E[]>
export function resultTuple<T, T2, T3, T4, E>(
  r1: Result<T, E>,
  r2: Result<T2, E>,
  r3: Result<T3, E>,
  r4: Result<T4, E>,
): Result<readonly [T, T2, T3, T4], E[]>
export function resultTuple<T, T2, T3, T4, T5, E>(
  r1: Result<T, E>,
  r2: Result<T2, E>,
  r3: Result<T3, E>,
  r4: Result<T4, E>,
  r5: Result<T5, E>,
): Result<readonly [T, T2, T3, T4, T5], E[]>
export function resultTuple(...results: Result<any, any>[]) {
  const errors = results.filter(isErr).map(x => x.left)
  if (errors.length) {
    return err(errors)
  }
  const successes = (results as Right<any>[]).map(x => x.right) as readonly any[]
  return ok(successes)
}

export const sequence = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  return compose(
    resultAll(results),
    E.mapLeft(flattenErrors),
  )
}

export const resultAll = <T, E>(results: Result<T, E>[]): Result<T[], E[]> => {
  const errors = results.filter(isErr).map(x => x.left)
  if (errors.length) {
    return err(errors)
  }
  const successes = results.filter(isOk).map(x => x.right)
  return ok(successes)
}

export const isErr = <T, TErr>(x: Result<T, TErr>): x is Left<TErr> => x._tag === "Left"
export const isOk = <T, TErr>(x: Result<T, TErr>): x is Right<T> => x._tag === "Right"

export const sequenceAsync = <T, E>(results: AsyncResult<T, E>[]): AsyncResult<T[], E> => {
  return async () => sequence(await Promise.all(results.map(x => x())))
}

export const resultAllAsync = <T, E>(results: AsyncResult<T, E>[]): AsyncResult<T[], E[]> => {
  return async () => resultAll(await Promise.all(results.map(x => x())))
}

export const flattenErrors = <E>(errors: E[]) => errors[0]

export const valueOrUndefined = <TInput, TOutput, TErrorOutput>(
  input: TInput | undefined,
  resultCreator: (input: TInput) => Result<TOutput, TErrorOutput>,
): Result<TOutput | undefined, TErrorOutput> => {
  if (input === undefined) {
    return ok(undefined)
  }
  return resultCreator(input)
}

// Unused
export const asyncValueOrUndefined = <TInput, TOutput, TErrorOutput>(
  input: TInput | undefined,
  resultCreator: PipeFunction<TInput, TOutput, TErrorOutput>,
): AsyncResult<TOutput | undefined, TErrorOutput> => async () => {
  if (input === undefined) {
    return ok(undefined)
  }
  return await resultCreator(input)()
}

export const createResult = <TErrorOutput = string, TInput = any, TOutput = any>(
  input: TInput | undefined,
  resultCreator: (input: TInput) => TOutput,
): Result<TOutput | undefined, TErrorOutput> => {
  if (input === undefined) {
    return ok(undefined)
  }
  return ok(resultCreator(input))
}

export const applyIfNotUndefined = <T, TOutput>(
  input: T | undefined,
  f: (input: T) => TOutput,
): TOutput | undefined => {
  if (input === undefined) {
    return undefined
  }
  return f(input)
}

export const asyncCreateResult = <TErrorOutput = string, TInput = any, TOutput = any>(
  input: TInput | undefined,
  resultCreator: (input: TInput) => Promise<TOutput>,
): AsyncResult<TOutput | undefined, TErrorOutput> => async () => {
  if (input === undefined) {
    return ok(undefined)
  }
  return ok(await resultCreator(input))
}

export const conditional = <TInput, TOutput, TErrorOutput>(
  input: TInput | undefined,
  resultCreator: PipeFunction2<TInput, TOutput, TErrorOutput>,
): Result<TOutput | undefined, TErrorOutput> => {
  if (input === undefined) {
    return ok(undefined)
  }
  return resultCreator(input)
}

export const liftType = <T>() => <TInput extends T>(e: TInput) => e as T

// Experiment

// Very nasty, need to find a cleaner approach
// TODO: This actually breaks error type enforcement
export const anyTrue = <TErr = any>(...mappers: any[]): Result<boolean, TErr> => {
  let hasChanged = false

  const mapHasChanged = map(a => (a ? (hasChanged = true) : null)) as any
  const items = mappers.map(_ => mapHasChanged)
  const execution = flatten(zip(mappers, items))

  const an = ok<boolean, TErr>(false) as any
  return compose(
    an,
    ...execution,
    map(() => hasChanged),
  )
}

// TODO: what if you could replace
// (event) => kickAsync(event).pipe(
// with:
// pipe(

// it would have to generate (event) => kickAsync(event).pipe(
// but also it would mean to add: map(event => event.id) to get just the id.
// const startWithValInt = <TErr>() => <T>(value: T) => ok<T, TErr>(value) as Result<T, TErr>

// export const startWithVal = <TErr>() => <T>(value: T) => Promise.resolve(startWithValInt<TErr>()(value))
// reversed curry:
export const startWithVal = <T>(value: T) => <TErr>() => TE.right<TErr, T>(value)
// export const startWithVal2 = startWithVal()
export const startWithVal2 = <T>(value: T) => startWithVal(value)()

export type PipeFunction<TInput, TOutput, TErr> = (input: TInput) => AsyncResult<TOutput, TErr>
export type PipeFunctionN<TOutput, TErr> = () => AsyncResult<TOutput, TErr>
export type PipeFunction2<TInput, TOutput, TErr> = (input: TInput) => Result<TOutput, TErr>
export type PipeFunction2N<TOutput, TErr> = () => Result<TOutput, TErr>

// helper for addressing some issues with syntax highlighting in editor when using multiple generics
export type AnyResult<T = any, TErr = any> = Result<T, TErr>

// We create tuples in reverse, under the assumption that the further away we are
// from previous statements, the less important their output becomes..
// Alternatively we can always create two variations :)
// tslint:disable:max-line-length
const intToFlatTup = (r: any, input: any) =>
  r._tag === "Right" ? ok([r.right, input[0], input[1]] as const) : err(r.left)

export function TEtoFlatTup<TInput, TInputB, TInput2 extends readonly [TInput, TInputB], T, EMap>(
  f: (x: TInput2) => AsyncResult<T, EMap>,
): <E>(input: readonly [TInput, TInputB]) => AsyncResult<readonly [T, TInput, TInputB], EMap>
export function TEtoFlatTup(f: any) {
  return (input: any) => async () => {
    const r = await f(input)()
    return intToFlatTup(r, input)
  }
}

export function EtoFlatTup<TInput, TInputB, TInput2 extends readonly [TInput, TInputB], T, EMap>(
  f: (x: TInput2) => Result<T, EMap>,
): <E>(input: readonly [TInput, TInputB]) => Result<readonly [T, TInput, TInputB], E>
export function EtoFlatTup(f: any) {
  return (input: any) => {
    const r = f(input)
    return intToFlatTup(r, input)
  }
}

export function toMagicTup<T1, T2, T3>(input: readonly [[T1, T2], T3]): readonly [T1, T2, T3]
export function toMagicTup([tup1, el]: any) {
  return tup1.concat([el])
}

export function apply<A, B>(a: A, f: (a: A) => B): B {
  return f(a)
}

//////
// Stabl at simplify working with resultTuple
// tslint:disable:max-line-length
// Doesn't work
export function resultTuple2<TInput, T, T2, E>(
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
): (input: TInput) => Result<readonly [T, T2], E[]>
export function resultTuple2<TInput, T, T2, T3, E>(
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
  r3: (input: TInput) => Result<T3, E>,
): (input: TInput) => Result<readonly [T, T2, T3], E[]>
export function resultTuple2<TInput, T, T2, T3, T4, E>(
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
  r3: (input: TInput) => Result<T3, E>,
  r4: (input: TInput) => Result<T4, E>,
): (input: TInput) => Result<readonly [T, T2, T3, T4], E[]>
export function resultTuple2<TInput, T, T2, T3, T4, T5, E>(
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
  r3: (input: TInput) => Result<T3, E>,
  r4: (input: TInput) => Result<T4, E>,
  r5: (input: TInput) => Result<T5, E>,
): (input: TInput) => Result<readonly [T, T2, T3, T4, T5], E[]>
export function resultTuple2(...resultFNs: ((input: any) => Result<any, any>)[]) {
  return (input: any) => {
    const results = resultFNs.map(x => x(input))
    const errors = results.filter(isErr).map(x => x.left)
    if (errors.length) {
      return err(errors)
    }
    const successes = (results as Right<any>[]).map(x => x.right) as readonly any[]
    return ok(successes)
  }
}

// not so cool?
export function resultTuple3<TInput, T, T2, E>(
  input: TInput,
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
): Result<readonly [T, T2], E[]>
export function resultTuple3<TInput, T, T2, T3, E>(
  input: TInput,
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
  r3: (input: TInput) => Result<T3, E>,
): Result<readonly [T, T2, T3], E[]>
export function resultTuple3<TInput, T, T2, T3, T4, E>(
  input: TInput,
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
  r3: (input: TInput) => Result<T3, E>,
  r4: (input: TInput) => Result<T4, E>,
): Result<readonly [T, T2, T3, T4], E[]>
export function resultTuple3<TInput, T, T2, T3, T4, T5, E>(
  input: TInput,
  r1: (input: TInput) => Result<T, E>,
  r2: (input: TInput) => Result<T2, E>,
  r3: (input: TInput) => Result<T3, E>,
  r4: (input: TInput) => Result<T4, E>,
  r5: (input: TInput) => Result<T5, E>,
): Result<readonly [T, T2, T3, T4, T5], E[]>
export function resultTuple3(input: any, ...resultFNs: ((input: any) => Result<any, any>)[]) {
  const results = resultFNs.map(x => x(input))
  const errors = results.filter(isErr).map(x => x.left)
  if (errors.length) {
    return err(errors)
  }
  const successes = (results as Right<any>[]).map(x => x.right) as readonly any[]
  return ok(successes)
}

export const success = <TErr>() => ok<void, TErr>(void 0)

// const pipe = (...args) => <T>(input: T) =>
//   compose(
//     TE.right(input),
//     ...args,
//   )

// export const pipeE = (...args) => <T>(input: T) =>
//   compose(
//     E.right(input),
//     ...args,
//   )

export function pipe<TInput, TError, TOutput>(
  ab: (c: TE.TaskEither<TError, TInput>) => TE.TaskEither<TError, TOutput>,
): (input: TInput) => TE.TaskEither<TError, TOutput>
export function pipe<TInput, TError, B, TOutput>(
  ab: (a: TE.TaskEither<TError, TInput>) => TE.TaskEither<TError, B>,
  bc: (c: TE.TaskEither<TError, B>) => TE.TaskEither<TError, TOutput>,
): (input: TInput) => TE.TaskEither<TError, TOutput>
export function pipe<TInput, TError, B, C, TOutput>(
  ab: (a: TE.TaskEither<TError, TInput>) => TE.TaskEither<TError, B>,
  bc: (b: TE.TaskEither<TError, B>) => TE.TaskEither<TError, C>,
  cd: (c: TE.TaskEither<TError, C>) => TE.TaskEither<TError, TOutput>,
): (input: TInput) => TE.TaskEither<TError, TOutput>
export function pipe<TInput, TError, B, C, D, TOutput>(
  ab: (a: TE.TaskEither<TError, TInput>) => TE.TaskEither<TError, B>,
  bc: (b: TE.TaskEither<TError, B>) => TE.TaskEither<TError, C>,
  cd: (b: TE.TaskEither<TError, C>) => TE.TaskEither<TError, D>,
  de: (c: TE.TaskEither<TError, D>) => TE.TaskEither<TError, TOutput>,
): (input: TInput) => TE.TaskEither<TError, TOutput>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pipe<TInput, TError, TOutput>(...a: any[]) {
  return (input: TInput) =>
    compose<TE.TaskEither<TError, TInput>, TE.TaskEither<TError, TOutput>>(
      TE.right<TError, TInput>(input),
      // @ts-ignore
      ...a,
    )
}
