import { createValidator, Joi } from "@fp-app/framework"
import { KoaRouteBuilder } from "@fp-app/hosting.koa"
import { paxSchema } from "./TrainTrip/PaxDefinition"
import changeTrainTrip from "./TrainTrip/usecases/changeTrainTrip"
import createTrainTrip from "./TrainTrip/usecases/createTrainTrip"
import deleteTrainTrip from "./TrainTrip/usecases/deleteTrainTrip"
import getTrainTrip from "./TrainTrip/usecases/getTrainTrip"
import lockTrainTrip from "./TrainTrip/usecases/lockTrainTrip"

const createTrainTripRouter = () =>
  new KoaRouteBuilder()
    .post("/", createTrainTrip, {
      validator: createValidator(
        Joi.object({
          pax: paxSchema.required(),
          startDate: Joi.date().required(),
          templateId: Joi.string().required(),
        }).required(),
      ),
    })
    .get("/:trainTripId", getTrainTrip, {
      validator: createValidator(routeWithTrainTripId),
    })
    .patch("/:trainTripId", changeTrainTrip, {
      validator: createValidator(
        Joi.object({
          pax: paxSchema,
          startDate: Joi.date(),
          trainTripId: trainTripIdValidator,
          travelClass: Joi.string(),
        })
          .or("pax", "travelClass", "startDate")
          .required(),
      ),
    })
    .delete("/:trainTripId", deleteTrainTrip, {
      validator: createValidator(routeWithTrainTripId),
    })
    .post("/:trainTripId/lock", lockTrainTrip, {
      validator: createValidator(routeWithTrainTripId),
    })

const trainTripIdValidator = Joi.string()
  .guid()
  .required()
const routeWithTrainTripId = Joi.object({
  trainTripId: trainTripIdValidator,
}).required()

export default createTrainTripRouter
