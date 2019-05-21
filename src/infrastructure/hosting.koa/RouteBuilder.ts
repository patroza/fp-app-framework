import Koa from 'koa'
import KoaRouter from 'koa-router'
import { requestType } from '../mediator'
import RouteBuilder from '../RouteBuilder'
import generateKoaHandler from './generateKoaHandler'
import { authMiddleware } from './middleware'

export default class KoaRouteBuilder extends RouteBuilder<Koa.Context> {
  build(request: requestType) {
    const router = new KoaRouter()
    if (this.basicAuthEnabled) {
      if (!this.userPass) { throw new Error('cannot enable auth without loginPass') }
      router.use(authMiddleware(this.userPass)())
    }

    this.setup.forEach(({ method, path, requestHandler, validator, errorHandler }) => {
      router.register(
        path, [method],
        generateKoaHandler(
          request,
          requestHandler,
          validator,
          errorHandler,
        ),
      )
    })

    return router
  }
}

export function createRouterFromMap(routerMap: Map<string, RouteBuilder<Koa.Context>>, request: requestType) {
  return [...routerMap.entries()].reduce((prev, cur) => {
    const koaRouter = cur[1].build(request)
    return prev.use(cur[0], koaRouter.allowedMethods(), koaRouter.routes())
  }, new KoaRouter())
}
