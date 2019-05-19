import { generateKoaHandler } from 'fp-app-framework/infrastructure/koa'
import { getHandlerType } from 'fp-app-framework/infrastructure/namespace'
import { createValidator, Joi } from 'fp-app-framework/utils/validation'
import KoaRouter from 'koa-router'
import changeTrainTrip from './TrainTrip/usecases/changeTrainTrip'
import createTrainTrip from './TrainTrip/usecases/createTrainTrip'
import getTrainTrip from './TrainTrip/usecases/getTrainTrip'
import lockTrainTrip from './TrainTrip/usecases/lockTrainTrip'

const createTrainTripRouter = (getHandler: getHandlerType) => {
  const router = new KoaRouter()
    .get('/:trainTripId',
      generateKoaHandler(
        getHandler(getTrainTrip),
        createValidator(routeWithTrainTripId),
      ),
    )

    .post('/',
      generateKoaHandler(
        getHandler(createTrainTrip),
        createValidator(Joi.object({
          pax: Joi.object().required(),
          startDate: Joi.date().required(),
          templateId: Joi.string().required(),
        }).required()),
      ),
    )
    .patch('/:trainTripId',
      generateKoaHandler(
        getHandler(changeTrainTrip),
        createValidator(Joi.object({
          pax: Joi.object(),
          startDate: Joi.date(),
          trainTripId: trainTripIdValidator,
          travelClass: Joi.string(),
        }).or('pax', 'travelClass', 'startDate').required()),
      ),
    )
    .post('/:trainTripId/lock',
      generateKoaHandler(
        getHandler(lockTrainTrip),
        createValidator(routeWithTrainTripId),
      ),
    )

  return router
}

const trainTripIdValidator = Joi.string().guid().required()
const routeWithTrainTripId = Joi.object({
  trainTripId: trainTripIdValidator,
}).required()

export default createTrainTripRouter
