// tslint:disable:max-classes-per-file

import { assert, Entity, ForbiddenError, InvalidStateError, ValidationError, valueEquals } from "@fp-app/framework"
import Event from "@fp-app/framework/src/event"
import {
  anyTrue, applyIfNotUndefined, err, flatMap, liftType, map, mapErr, mapStatic, ok, Result, success, valueOrUndefined,
} from "@fp-app/neverthrow-extensions"
import isEqual from "lodash/fp/isEqual"
import FutureDate from "./FutureDate"
import PaxDefinition from "./PaxDefinition"
import TravelClassDefinition from "./TravelClassDefinition"
import Trip, { TravelClass } from "./Trip"

export default class TrainTrip extends Entity {

  static create(
    { startDate, pax }: { startDate: FutureDate, pax: PaxDefinition },
    trip: Trip,
    currentTravelClass: TravelClass,
  ) {
    assert.isNotNull({ trip, currentTravelClass })

    const t = new TrainTrip()
    t.w.trip = trip
    t.w.startDate = startDate.value
    t.w.pax = pax
    t.w.travelClassConfiguration = trip.travelClasss.map(x => new TravelClassConfiguration(x))

    const currentTravelClassConfiguration = t.travelClassConfiguration.find(x => x.travelClass.name === currentTravelClass.name)
    // TODO: try not to throw Error, nor converting to static create()..
    if (!currentTravelClassConfiguration) { throw new Error("passed an unknown travel class") }
    t.w.currentTravelClassConfiguration = currentTravelClassConfiguration

    t.registerDomainEvent(new TrainTripCreated(t.id))

    return t
  }

  readonly createdAt = new Date()
  readonly pax!: PaxDefinition
  readonly startDate!: Date
  readonly isLocked: boolean = false
  readonly lockedAt?: Date
  readonly opportunityId?: string
  readonly travelClassConfiguration: TravelClassConfiguration[] = []
  readonly currentTravelClassConfiguration!: TravelClassConfiguration
  readonly trip!: Trip

  private constructor() { super() }

  proposeChanges(state: StateProposition) {
    assert.isNotNull({ state })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(state),
        mapErr(liftType<ValidationError | ForbiddenError | InvalidStateError>()),
        flatMap(this.applyDefinedChanges),
        map(this.createChangeEvents),
      )
  }

  lock() {
    this.w.isLocked = true
    this.w.lockedAt = new Date()

    this.registerDomainEvent(new TrainTripStateChanged(this.id))
  }

  assignOpportunity(opportunityId: string) {
    this.w.opportunityId = opportunityId
  }

  readonly updateTrip = (trip: Trip) => {
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

  // TODO: This seems like cheating, we're missing another Aggregate Root..
  readonly delete = () => {
    this.registerDomainEvent(new TrainTripDeleted(this.id))
  }

  ////////////
  //// Separate sample; not used other than testing
  async changeStartDate(startDate: FutureDate) {
    assert.isNotNull({ startDate })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(startDate),
        map(this.intChangeStartDate),
        map(this.createChangeEvents),
      )
  }

  async changePax(pax: PaxDefinition) {
    assert.isNotNull({ pax })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(pax),
        map(this.intChangePax),
        map(this.createChangeEvents),
      )
  }

  async changeTravelClass(travelClass: TravelClassDefinition) {
    assert.isNotNull({ travelClass })

    return this.confirmUserChangeAllowed()
      .pipe(
        mapStatic(travelClass),
        mapErr(liftType<ForbiddenError | InvalidStateError>()),
        flatMap(this.intChangeTravelClass),
        map(this.createChangeEvents),
      )
  }
  //// End Separate sample; not used other than testing
  ////////////

  private readonly applyDefinedChanges = ({ startDate, pax, travelClass }: StateProposition) =>
    anyTrue<ValidationError | InvalidStateError>(
      map(() => applyIfNotUndefined(startDate, this.intChangeStartDate)),
      map(() => applyIfNotUndefined(pax, this.intChangePax)),
      flatMap(() => valueOrUndefined(travelClass, this.intChangeTravelClass)),
    )

  private readonly intChangeStartDate = (startDate: FutureDate) => {
    if (valueEquals(startDate, this.startDate, v => v.toISOString())) { return false }

    this.w.startDate = startDate.value
    // TODO: other business logic

    return true
  }

  private readonly intChangePax = (pax: PaxDefinition) => {
    if (isEqual(this.pax, pax)) { return false }

    this.w.pax = pax
    // TODO: other business logic

    return true
  }

  private readonly intChangeTravelClass = (travelClass: TravelClassDefinition): Result<boolean, InvalidStateError> => {
    const slc = this.travelClassConfiguration.find(x => x.travelClass.name === travelClass.value)
    if (!slc) { return err(new InvalidStateError(`${travelClass.value} not available currently`)) }
    if (this.currentTravelClassConfiguration === slc) { return ok(false) }
    this.w.currentTravelClassConfiguration = slc
    return ok(true)
  }

  private confirmUserChangeAllowed(): Result<void, ForbiddenError> {
    if (this.isLocked) {
      return err(new ForbiddenError(`No longer allowed to change TrainTrip ${this.id}`))
    }
    return success()
  }

  private readonly createChangeEvents = (changed: boolean) => {
    this.registerDomainEvent(new UserInputReceived(this.id))
    if (changed) { this.registerDomainEvent(new TrainTripStateChanged(this.id)) }
  }
}

export class TravelClassConfiguration {
  readonly priceLastUpdated?: Date
  readonly price!: Price

  constructor(readonly travelClass: TravelClass) { }
}

/*
These event names look rather technical (like CRUD) and not very domain driven

*/

export class TrainTripCreated extends Event {
  constructor(readonly trainTripId: TrainTripId) {
    super()
  }
}

export class UserInputReceived extends Event {
  constructor(readonly trainTripId: TrainTripId) { super() }
}

export class TrainTripStateChanged extends Event {
  constructor(readonly trainTripId: TrainTripId) { super() }
}

export class TrainTripDeleted extends Event {
  constructor(readonly trainTripId: TrainTripId) { super() }
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
