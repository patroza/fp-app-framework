import { generateKoaHandler } from 'fp-app-framework/infrastructure/koa'
import { getHandlerType } from 'fp-app-framework/infrastructure/namespace'
import { createValidator, Joi } from 'fp-app-framework/utils/validation'
import KoaRouter from 'koa-router'
import changeTrainTrip from './TrainTrip/usecases/changeTrainTrip'
import createTrainTrip from './TrainTrip/usecases/createTrainTrip'
import getTrainTrip from './TrainTrip/usecases/getTrainTrip'
import lockTrainTrip from './TrainTrip/usecases/lockTrainTrip'

import convert from 'joi-to-json-schema'
import { paxSchema } from './TrainTrip/PaxDefinition'

const createTrainTripRouter = (getHandler: getHandlerType) => {
  const jsonSchemas: any[] = []
  const createValidatorLocal = <T>(schema: any) => {
    jsonSchemas.push(convert(schema))
    return createValidator<T>(schema)
  }

  const router = new KoaRouter()
    .get('/:trainTripId',
      generateKoaHandler(
        getHandler(getTrainTrip),
        createValidatorLocal(routeWithTrainTripId),
      ),
    )

    .post('/',
      generateKoaHandler(
        getHandler(createTrainTrip),
        createValidatorLocal(Joi.object({
          pax: paxSchema.required(),
          startDate: Joi.date().required(),
          templateId: Joi.string().required(),
        }).required()),
      ),
    )
    .patch('/:trainTripId',
      generateKoaHandler(
        getHandler(changeTrainTrip),
        createValidatorLocal(Joi.object({
          pax: paxSchema,
          startDate: Joi.date(),
          trainTripId: trainTripIdValidator,
          travelClass: Joi.string(),
        }).or('pax', 'travelClass', 'startDate').required()),
      ),
    )
    .post('/:trainTripId/lock',
      generateKoaHandler(
        getHandler(lockTrainTrip),
        createValidatorLocal(routeWithTrainTripId),
      ),
    )

  const jsonSchema = router.stack.map((x, i) =>
    [x.methods[x.methods.length - 1], x.path, jsonSchemas[i]],
  )

  return [router, jsonSchema] as [typeof router, typeof jsonSchema]
}

const trainTripIdValidator = Joi.string().guid().required()
const routeWithTrainTripId = Joi.object({
  trainTripId: trainTripIdValidator,
}).required()

export default createTrainTripRouter
