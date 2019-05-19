import TrainTrip from '@/TrainTrip/TrainTrip'
import { RecordContext, UnitOfWork } from 'fp-app-framework/infrastructure/context.base'
import { RequestContextBase } from 'fp-app-framework/infrastructure/misc'
import { generateKey } from 'fp-app-framework/infrastructure/SimpleContainer'
import { TrainTripPublisher } from '../eventhandlers'

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
