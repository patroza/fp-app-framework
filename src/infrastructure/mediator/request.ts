import { requestType, UsecaseWithDependencies } from '.'

const request = (get: (key: any) => any): requestType =>
  <TInput, TOutput, TError>(requestHandler: UsecaseWithDependencies<any, TInput, TOutput, TError>, input: TInput) => {
    const handler = get(requestHandler)
    return handler(input)
  }

export default request
