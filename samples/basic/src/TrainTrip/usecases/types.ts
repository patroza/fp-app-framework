import TrainTrip, { Price } from "@/TrainTrip/TrainTrip"
import {
  ApiError,
  ConnectionError,
  generateKey,
  generateKeyFromFn,
  RecordContext,
  RequestContextBase,
  UnitOfWork,
} from "@fp-app/framework"
import { PipeFunction, AsyncResult } from "@fp-app/fp-ts-extensions"
import { TrainTripPublisher } from "../eventhandlers"
import { getTrip, sendCloudSyncFake, Template, TravelPlan } from "../infrastructure/api"
import PaxDefinition from "../PaxDefinition"

export const getTripKey = generateKeyFromFn(getTrip)
export const sendCloudSyncKey = generateKey<ReturnType<typeof sendCloudSyncFake>>(
  "sendCloudSync",
)
export type getTravelPlanType = PipeFunction<string, TravelPlan, ApiError>
export type getTemplateType = PipeFunction<string, Template, ApiError>
export type getPricingType = (
  templateId: string,
  pax: PaxDefinition,
  startDate: Date,
) => AsyncResult<{ price: Price }, ApiError>
export type createTravelPlanType = (
  templateId: string,
  info: { pax: PaxDefinition; startDate: Date },
) => AsyncResult<string, ConnectionError>

// tslint:disable-next-line:no-empty-interface
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReadonlyContext {}

export interface ReadonlyTrainTripContext extends ReadonlyContext {
  trainTrips: RecordContext<TrainTrip>
}

export interface TrainTripContext extends ReadonlyTrainTripContext, UnitOfWork {}

// tslint:disable-next-line:no-empty-interface
export type RequestContext = RequestContextBase & { [key: string]: any }

export const RequestContextKey = generateKey<RequestContext>("request-context")
export const DbContextKey = generateKey<ReadonlyTrainTripContext>("db-context")
export const TrainTripPublisherKey = generateKey<TrainTripPublisher>(
  "trainTripPublisher",
)

export const defaultDependencies = { context: RequestContextKey }
