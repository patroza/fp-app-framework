// tslint:disable:max-classes-per-file

import {
  Entity,
  ForbiddenError,
  generateUuid,
  InvalidStateError,
  ValidationError,
  valueEquals,
} from "@fp-app/framework"
import Event from "@fp-app/framework/src/event"
import {
  anyTrue,
  applyIfNotUndefined,
  err,
  liftType,
  ok,
  Result,
  success,
  valueOrUndefined,
  E,
  pipe,
} from "@fp-app/fp-ts-extensions"
import isEqual from "lodash/fp/isEqual"
import FutureDate from "./FutureDate"
import PaxDefinition from "./PaxDefinition"
import TravelClassDefinition from "./TravelClassDefinition"
import Trip, { TravelClass, TripWithSelectedTravelClass } from "./Trip"

export default class TrainTrip extends Entity {
  /** the primary way to create a new TrainTrip */
  static create(
    { pax, startDate }: { startDate: FutureDate; pax: PaxDefinition },
    trip: TripWithSelectedTravelClass,
  ) {
    const travelClassConfiguration = trip.travelClasses.map(
      x => new TravelClassConfiguration(x),
    )
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const currentTravelClassConfiguration = travelClassConfiguration.find(
      x => x.travelClass.name === trip.currentTravelClass.name,
    )!

    const t = new TrainTrip(
      generateUuid(),
      pax,
      startDate.value,
      travelClassConfiguration,
      currentTravelClassConfiguration,
    )
    // TODO: Consider the creation of a train trip to have another starting point,
    // like currentUser.createTrainTrip(), where the domain event then naturally
    // occurs inside the currentUser instead :/
    t.registerDomainEvent(new TrainTripCreated(t.id))

    return t
  }

  readonly createdAt = new Date()
  readonly opportunityId?: string
  readonly lockedAt?: Date
  get isLocked() {
    return Boolean(this.lockedAt)
  }

  /** use TrainTrip.create() instead */
  constructor(
    id: string,
    readonly pax: PaxDefinition,
    readonly startDate: Date,
    readonly travelClassConfiguration: TravelClassConfiguration[] = [],
    readonly currentTravelClassConfiguration: TravelClassConfiguration,
    rest?: Partial<
      Omit<
        { -readonly [key in keyof TrainTrip]: TrainTrip[key] },
        | "id"
        | "pax"
        | "startDate"
        | "travelClassConfiguration"
        | "currentTravelClassConfiguration"
        | "trip"
      >
    >,
    // rest?: Partial<{ -readonly [key in keyof TrainTrip]: TrainTrip[key] }>,
  ) {
    super(id)
    Object.assign(this, rest)
  }

  proposeChanges(state: StateProposition) {
    return pipe(
      this.confirmUserChangeAllowed(),
      E.chain(() =>
        pipe(
          this.applyDefinedChanges(state),
          E.mapLeft(liftType<ValidationError | InvalidStateError | ForbiddenError>()),
        ),
      ),
      E.map(this.createChangeEvents),
    )
  }

  lock() {
    this.w.lockedAt = new Date()

    this.registerDomainEvent(new TrainTripStateChanged(this.id))
  }

  assignOpportunity(opportunityId: string) {
    this.w.opportunityId = opportunityId
  }

  readonly updateTrip = (trip: Trip) => {
    // This will clear all configurations upon trip update
    // TODO: Investigate a resolution mechanism to update existing configurations, depends on business case ;-)
    this.w.travelClassConfiguration = trip.travelClasses.map(
      x => new TravelClassConfiguration(x),
    )
    const currentTravelClassConfiguration = this.travelClassConfiguration.find(
      x => this.currentTravelClassConfiguration.travelClass.name === x.travelClass.name,
    )
    this.w.currentTravelClassConfiguration =
      currentTravelClassConfiguration || this.travelClassConfiguration[0]!
  }

  // TODO: This seems like cheating, we're missing another Aggregate Root..
  readonly delete = () => {
    this.registerDomainEvent(new TrainTripDeleted(this.id))
  }

  ////////////
  //// Separate sample; not used other than testing
  changeStartDate(startDate: FutureDate) {
    return pipe(
      this.confirmUserChangeAllowed(),
      E.map(() => startDate),
      E.map(this.intChangeStartDate),
      E.map(this.createChangeEvents),
    )
  }

  changePax(pax: PaxDefinition) {
    return pipe(
      this.confirmUserChangeAllowed(),
      E.map(() => pax),
      E.map(this.intChangePax),
      E.map(this.createChangeEvents),
    )
  }

  changeTravelClass(travelClass: TravelClassDefinition) {
    return pipe(
      this.confirmUserChangeAllowed(),
      E.chain(() =>
        pipe(
          this.intChangeTravelClass(travelClass),
          E.mapLeft(liftType<ForbiddenError | InvalidStateError>()),
        ),
      ),
      E.map(this.createChangeEvents),
    )
  }
  //// End Separate sample; not used other than testing
  ////////////

  private readonly applyDefinedChanges = ({
    pax,
    startDate,
    travelClass,
  }: StateProposition) =>
    anyTrue<ValidationError | InvalidStateError>(
      E.map(() => applyIfNotUndefined(startDate, this.intChangeStartDate)),
      E.map(() => applyIfNotUndefined(pax, this.intChangePax)),
      E.chain(() => valueOrUndefined(travelClass, this.intChangeTravelClass)),
    )

  private readonly intChangeStartDate = (startDate: FutureDate) => {
    if (valueEquals(startDate, this.startDate, v => v.toISOString())) {
      return false
    }

    this.w.startDate = startDate.value
    // TODO: other business logic

    return true
  }

  private readonly intChangePax = (pax: PaxDefinition) => {
    if (isEqual(this.pax, pax)) {
      return false
    }

    this.w.pax = pax
    // TODO: other business logic

    return true
  }

  private readonly intChangeTravelClass = (
    travelClass: TravelClassDefinition,
  ): Result<boolean, InvalidStateError> => {
    const slc = this.travelClassConfiguration.find(
      x => x.travelClass.name === travelClass.value,
    )
    if (!slc) {
      return err(new InvalidStateError(`${travelClass.value} not available currently`))
    }
    if (this.currentTravelClassConfiguration === slc) {
      return ok(false)
    }
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
    if (changed) {
      this.registerDomainEvent(new TrainTripStateChanged(this.id))
    }
  }
}

export class TravelClassConfiguration {
  readonly priceLastUpdated?: Date
  readonly price!: Price

  constructor(readonly travelClass: TravelClass) {}
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
  constructor(readonly trainTripId: TrainTripId) {
    super()
  }
}

export class TrainTripStateChanged extends Event {
  constructor(readonly trainTripId: TrainTripId) {
    super()
  }
}

export class TrainTripDeleted extends Event {
  constructor(readonly trainTripId: TrainTripId) {
    super()
  }
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
