import { assert, Event } from "@fp-app/framework"

// tslint:disable:max-classes-per-file

export class CustomerRequestedChanges extends Event {
  constructor(readonly trainTripId: string, readonly itineraryId: string) {
    super()
    assert.isNotNull({ trainTripId, itineraryId })
  }
}
