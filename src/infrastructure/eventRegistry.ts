
// tslint:disable-next-line:ban-types
const handlerMap = new Map<any, any[]>() // Array<[Function, Function, {}]>

export const registerEvent = (event: any, handler: any) => {
  const current = handlerMap.get(event) || []
  current.push(handler)
  handlerMap.set(event, current)
}

export const getRegisteredEvents = () => [...handlerMap.entries()]
