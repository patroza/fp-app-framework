import { NamedHandlerWithDependencies, NamedRequestHandler, requestType } from "."

const request = (get: getRequestType): requestType =>
  (requestHandler, input) => {
    const handler = get(requestHandler)
    return handler(input)
  }

export default request

type getRequestType = <TInput, TOutput, TError>(key: NamedHandlerWithDependencies<any, TInput, TOutput, TError>) =>
  NamedRequestHandler<TInput, TOutput, TError>
