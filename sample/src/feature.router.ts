import { generateKoaHandler } from 'fp-app-framework/src/infrastructure/koa'
import { createValidator, Joi } from 'fp-app-framework/src/utils/validation'
import KoaRouter from 'koa-router'
import create from './feature/usecases/create'
import get from './feature/usecases/get'

const createITPRouter = (usecases: ReturnTypes<UsecasesUnconfigured>) => {
  const itpRouter = new KoaRouter()
    .get('/:featureId',
      generateKoaHandler(
        usecases.get,
        createValidator(Joi.object({
          featureId: Joi.string().required(),
        }).required()),
      ),
    )

    .post('/',
      generateKoaHandler(
        usecases.create,
        createValidator(Joi.object({
          configuration: Joi.object().required(),
          somethingElseId: Joi.string().uuid().required(),
          somethingId: Joi.string().required(),
          startDate: Joi.date().required(),
        }).required()),
      ),
    )

  return itpRouter
}

interface UsecasesUnconfigured extends FunctionDefinitions {
  create: typeof create
  get: typeof get
}

export default createITPRouter
