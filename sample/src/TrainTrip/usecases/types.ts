import TrainTrip, { Price } from '@/TrainTrip/TrainTrip'
import { RecordContext, UnitOfWork } from 'fp-app-framework/src/infrastructure/context.base'
import { ApiError, ConnectionError } from 'fp-app-framework/src/infrastructure/errors'
import { RequestContextBase } from 'fp-app-framework/src/infrastructure/misc'
import { generateKey } from 'fp-app-framework/src/infrastructure/SimpleContainer'
import { PipeFunction } from 'fp-app-framework/src/utils/neverthrow-extensions'
import { Result } from 'neverthrow'
import { TrainTripPublisher } from '../eventhandlers'
import { Template, TravelPlan } from '../infrastructure/api'
import PaxDefinition from '../PaxDefinition'
import Trip from '../Trip'

export const getTripKey = generateKey<PipeFunction<string, Trip, ApiError>>('getTrip')

export type getTravelPlanType = PipeFunction<string, TravelPlan, ApiError>
export type getTemplateType = PipeFunction<string, Template, ApiError>
export type getPricingType = (templateId: string, pax: PaxDefinition, startDate: Date) => Promise<Result<{ price: Price }, ApiError>>
export type createTravelPlanType = (templateId: string, info: { pax: PaxDefinition, startDate: Date }) => Promise<Result<string, ConnectionError>>

export const sendCloudSyncKey = generateKey<PipeFunction<TrainTrip, string, ConnectionError>>('sendCloudSync')

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

export const defaultDependencies = { context: RequestContextKey }

export const TrainTripPublisherKey = generateKey<TrainTripPublisher>('trainTripPublisher')
