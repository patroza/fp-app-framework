import { authMiddleware as authMiddlewareCreator } from 'fp-app-framework/infrastructure/koa'
import { DEFAULT_AUTH } from './config'

export const authMiddleware = authMiddlewareCreator(DEFAULT_AUTH)
