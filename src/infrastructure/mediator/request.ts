import { NamedRequestHandler, requestType, UsecaseWithDependencies } from '.'

const request = (get: getKeyType): requestType =>
  (requestHandler, input) => {
    const handler = get(requestHandler)
    return handler(input)
  }

export default request

type getKeyType = <TInput, TOutput, TError>(key: UsecaseWithDependencies<any, TInput, TOutput, TError>) =>
  NamedRequestHandler<TInput, TOutput, TError>
