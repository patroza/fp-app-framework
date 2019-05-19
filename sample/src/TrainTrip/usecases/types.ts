import TrainTrip, { Price } from '@/TrainTrip/TrainTrip'
import { RecordContext, UnitOfWork } from 'fp-app-framework/infrastructure/context.base'
import { ApiError, ConnectionError } from 'fp-app-framework/infrastructure/errors'
import { RequestContextBase } from 'fp-app-framework/infrastructure/misc'
import { generateKey, generateKeyFromFn } from 'fp-app-framework/infrastructure/SimpleContainer'
import { PipeFunction, Result } from 'fp-app-framework/utils/neverthrow-extensions'
import { TrainTripPublisher } from '../eventhandlers'
import { getTrip, sendCloudSyncFake, Template, TravelPlan } from '../infrastructure/api'
import PaxDefinition from '../PaxDefinition'

export const getTripKey = generateKeyFromFn(getTrip)
export const sendCloudSyncKey = generateKeyFromFn(sendCloudSyncFake)
export type getTravelPlanType = PipeFunction<string, TravelPlan, ApiError>
export type getTemplateType = PipeFunction<string, Template, ApiError>
export type getPricingType = (templateId: string, pax: PaxDefinition, startDate: Date) => Promise<Result<{ price: Price }, ApiError>>
export type createTravelPlanType = (templateId: string, info: { pax: PaxDefinition, startDate: Date }) => Promise<Result<string, ConnectionError>>

// tslint:disable-next-line:no-empty-interface
export interface ReadonlyContext { }

export interface ReadonlyTrainTripContext extends ReadonlyContext {
  trainTrips: RecordContext<TrainTrip>
}

export interface TrainTripContext extends ReadonlyTrainTripContext, UnitOfWork { }

// tslint:disable-next-line:no-empty-interface
export type RequestContext = RequestContextBase & { [key: string]: any }

export const RequestContextKey = generateKey<RequestContext>('context')
export const DbContextKey = generateKey<ReadonlyTrainTripContext>('db')
export const TrainTripPublisherKey = generateKey<TrainTripPublisher>('trainTripPublisher')

export const defaultDependencies = { context: RequestContextKey }
