import { authMiddleware as authMiddlewareCreator } from 'fp-app-framework/infrastructure/koa'
import fs from 'fs'
import KoaRouter from 'koa-router'
import { DEFAULT_AUTH } from './config'

export const authMiddleware = authMiddlewareCreator(DEFAULT_AUTH)

export function createRouterFromMap(routerMap: Map<string, [KoaRouter<any, {}>, any[][]]>) {
  return [...routerMap.entries()].reduce((prev, cur) => prev.use(cur[0], cur[1][0].allowedMethods(), cur[1][0].routes()), new KoaRouter())
}

export function writeRouterSchema(routerMap: Map<string, [KoaRouter<any, {}>, any[][]]>) {
  const schema = [...routerMap.entries()].reduce((prev, [path, [_, s]]) => {
    prev[path] = s.map(([method, p, s2]) => ({ method, subPath: p, fullPath: `${path}${p}`, schema: s2 }))
    return prev
  }, {} as any)
  fs.writeFileSync('./router-schema.json', JSON.stringify(schema, undefined, 2))
}
