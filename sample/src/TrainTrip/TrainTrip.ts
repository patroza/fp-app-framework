// tslint:disable:max-classes-per-file

import Entity from 'fp-app-framework/entity'
import { ForbiddenError, ValidationError } from 'fp-app-framework/errors'
import { asWritable } from 'fp-app-framework/utils'
import assert from 'fp-app-framework/utils/assert'
import {
  anyTrue, applyIfNotUndefined, err, flatMap, map, mapStatic, ok, Result, valueOrUndefined,
} from 'fp-app-framework/utils/neverthrow-extensions'
import { valueEquals } from 'fp-app-framework/utils/validation'
import isEqual from 'lodash/fp/isEqual'
import FutureDate from './FutureDate'
import PaxDefinition from './PaxDefinition'
import TravelClassDefinition from './TravelClassDefinition'
import Trip, { TravelClass } from './Trip'

export default class TrainTrip extends Entity {
  // workaround so that we can make props look readonly on the outside, but allow to change on the inside.
  // doesn't work if assigned as property :/
  private get w() { return asWritable(this) }
  public readonly createdAt = new Date()

  public readonly pax: PaxDefinition
  public readonly startDate: Date
  public readonly isLocked: boolean = false
  public readonly lockedAt?: Date
  public readonly opportunityId?: string
  public readonly travelClassConfiguration: TravelClassConfiguration[] = []
  public readonly currentTravelClassConfiguration: TravelClassConfiguration

  constructor(
    { startDate, pax }: { startDate: FutureDate, pax: PaxDefinition },
    public readonly trip: Trip,
    currentTravelClass: TravelClass,
  ) {
    super()
    assert.isNotNull({ trip, currentTravelClass })

    this.startDate = startDate.value
    this.pax = pax
    this.travelClassConfiguration = trip.travelClasss.map(x => new TravelClassConfiguration(x))

    const currentTravelClassConfiguration = this.travelClassConfiguration.find(x => x.travelClass.name === currentTravelClass.name)
    // TODO: try not to throw Error, nor converting to static create()..
    if (!currentTravelClassConfiguration) { throw new Error('passed an unknown travel class') }
    this.currentTravelClassConfiguration = currentTravelClassConfiguration

    this.registerDomainEvent(new TrainTripCreated(this.id))
  }

  public proposeChanges(state: StateProposition) {
    assert.isNotNull({ state })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(state),
        flatMap(this.applyDefinedChanges),
        map(this.createChangeEvents),
      )
  }

  public lock() {
    this.w.isLocked = true
    this.w.lockedAt = new Date()
  }

  public assignOpportunity(opportunityId: string) {
    this.w.opportunityId = opportunityId
  }

  public updateTrip = (trip: Trip) => {
    assert.isNotNull({ trip })

    this.w.trip = trip
    // This will clear all configurations upon trip update
    // TODO: Investigate a resolution mechanism to update existing configurations, depends on business case ;-)
    this.w.travelClassConfiguration = trip.travelClasss.map(x => new TravelClassConfiguration(x))
    const currentTravelClassConfiguration = (
      this.travelClassConfiguration.find(x => this.currentTravelClassConfiguration.travelClass.name === x.travelClass.name)
    )
    this.w.currentTravelClassConfiguration = currentTravelClassConfiguration || this.travelClassConfiguration[0]!
  }

  ////////////
  //// Separate sample; not used other than testing
  public async changeStartDate(startDate: FutureDate) {
    assert.isNotNull({ startDate })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(startDate),
        map(this.intChangeStartDate),
        map(this.createChangeEvents),
      )
  }

  public async changePax(pax: PaxDefinition) {
    assert.isNotNull({ pax })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(pax),
        map(this.intChangePax),
        map(this.createChangeEvents),
      )
  }

  public async changeTravelClass(travelClass: TravelClassDefinition) {
    assert.isNotNull({ travelClass })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(travelClass),
        flatMap(this.intChangeTravelClass),
        map(this.createChangeEvents),
      )
  }
  //// End Separate sample; not used other than testing
  ////////////

  private applyDefinedChanges = ({ startDate, pax, travelClass }: StateProposition) =>
    anyTrue<ValidationError>(
      map(() => applyIfNotUndefined(startDate, this.intChangeStartDate)),
      map(() => applyIfNotUndefined(pax, this.intChangePax)),
      flatMap(() => valueOrUndefined(travelClass, this.intChangeTravelClass)),
    )

  private intChangeStartDate = (startDate: FutureDate) => {
    if (valueEquals(startDate, this.startDate, v => v.toISOString())) { return false }

    this.w.startDate = startDate.value
    // TODO: other business logic

    return true
  }

  private intChangePax = (pax: PaxDefinition) => {
    if (isEqual(this.pax, pax)) { return false }

    this.w.pax = pax
    // TODO: other business logic

    return true
  }

  private intChangeTravelClass = (travelClass: TravelClassDefinition): Result<boolean, ValidationError> => {
    const slc = this.travelClassConfiguration.find(x => x.travelClass.name === travelClass.value)
    if (!slc) { return err(new ValidationError(`${travelClass.value} not found`)) }
    if (this.currentTravelClassConfiguration === slc) { return ok(false) }
    this.w.currentTravelClassConfiguration = slc
    return ok(true)
  }

  private confirmUserChangeAllowed(): Result<void, ValidationError> {
    if (this.isLocked) {
      return err(new ForbiddenError(`No longer allowed to change TrainTrip ${this.id}`))
    }
    return ok(void 0)
  }

  private createChangeEvents = (changed: boolean) => {
    this.registerDomainEvent(new UserInputReceived(this.id))
    if (changed) { this.registerDomainEvent(new TrainTripStateChanged(this.id)) }
  }
}

export class TravelClassConfiguration {
  // workaround so that we can make props look readonly on the outside, but allow to change on the inside.
  // doesn't work if assigned as property :/
  private get w() { return asWritable(this) }

  public readonly priceLastUpdated?: Date
  public readonly price!: Price

  constructor(public readonly travelClass: TravelClass) { }

  public updateTravelClass(travelClass: TravelClass) {
    assert.isNotNull({ travelClass })

    this.w.travelClass = travelClass
  }
}

export class TrainTripCreated {
  constructor(public readonly id: TrainTripId) { }
}

export class UserInputReceived {
  constructor(public readonly id: TrainTripId) { }
}

export class TrainTripStateChanged {
  constructor(public readonly id: TrainTripId) { }
}

export interface StateProposition {
  pax?: PaxDefinition
  startDate?: FutureDate
  travelClass?: TravelClassDefinition
}

export interface CreateTrainTripInfo {
  pax: PaxDefinition
  startDate: FutureDate
  templateId: string
}

export type ID = string
export type TrainTripId = ID
export type TemplateId = ID

export interface Price {
  amount: number
  currency: string
}
