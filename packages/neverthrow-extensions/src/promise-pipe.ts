type UnaryFunction<T, R> = (source: T) => R

/* tslint:disable:max-line-length */
export function pipe<T>(): UnaryFunction<T, T>
export function pipe<T, A>(fn1: UnaryFunction<T, A>): UnaryFunction<T, A>
export function pipe<T, A, B>(fn1: UnaryFunction<T, A>, fn2: UnaryFunction<A, B>): UnaryFunction<T, B>
export function pipe<T, A, B, C>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
): UnaryFunction<T, C>
export function pipe<T, A, B, C, D>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
): UnaryFunction<T, D>
export function pipe<T, A, B, C, D, E>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
  fn5: UnaryFunction<D, E>,
): UnaryFunction<T, E>
export function pipe<T, A, B, C, D, E, F>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
  fn5: UnaryFunction<D, E>,
  fn6: UnaryFunction<E, F>,
): UnaryFunction<T, F>
export function pipe<T, A, B, C, D, E, F, G>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
  fn5: UnaryFunction<D, E>,
  fn6: UnaryFunction<E, F>,
  fn7: UnaryFunction<F, G>,
): UnaryFunction<T, G>
export function pipe<T, A, B, C, D, E, F, G, H>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
  fn5: UnaryFunction<D, E>,
  fn6: UnaryFunction<E, F>,
  fn7: UnaryFunction<F, G>,
  fn8: UnaryFunction<G, H>,
): UnaryFunction<T, H>
export function pipe<T, A, B, C, D, E, F, G, H, I>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
  fn5: UnaryFunction<D, E>,
  fn6: UnaryFunction<E, F>,
  fn7: UnaryFunction<F, G>,
  fn8: UnaryFunction<G, H>,
  fn9: UnaryFunction<H, I>,
): UnaryFunction<T, I>
export function pipe<T, A, B, C, D, E, F, G, H, I>(
  fn1: UnaryFunction<T, A>,
  fn2: UnaryFunction<A, B>,
  fn3: UnaryFunction<B, C>,
  fn4: UnaryFunction<C, D>,
  fn5: UnaryFunction<D, E>,
  fn6: UnaryFunction<E, F>,
  fn7: UnaryFunction<F, G>,
  fn8: UnaryFunction<G, H>,
  fn9: UnaryFunction<H, I>,
  ...fns: UnaryFunction<any, any>[]
): UnaryFunction<T, {}>
/* tslint:enable:max-line-length */

export function pipe(...fns: UnaryFunction<any, any>[]): UnaryFunction<any, any> {
  return pipeFromArray(fns, (prev, fn) => prev.then(fn))
}

export function pipe2(...fns: UnaryFunction<any, any>[]): UnaryFunction<any, any> {
  return pipeFromArray(fns, (prev, fn) => fn(prev))
}

// tslint:disable-next-line:no-empty
const noop = () => {}

/** @internal */
export function pipeFromArray<T, R>(
  fns: UnaryFunction<T, R>[],
  transform: (prev: any, fn: any) => any,
): UnaryFunction<T, R> {
  if (!fns) {
    return noop as UnaryFunction<any, any>
  }

  // if (fns.length === 1) {
  //   return (input) => transform(input, fns[0]);
  // }

  return function piped(input: T): R {
    return fns.reduce((prev: any, fn: UnaryFunction<T, R>) => transform(prev, fn), input as any)
  }
}

Promise.prototype.pipe = function piper(this: Promise<any>, ...fns: any[]) {
  const pipeAny: any = pipe
  return pipeAny(...fns)((this as any) as Promise<any>)
} as any
