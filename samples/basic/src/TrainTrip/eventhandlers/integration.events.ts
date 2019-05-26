import { assert, Event } from "@fp-app/framework"

// tslint:disable:max-classes-per-file

export class CustomerRequestedChanges extends Event {
  constructor(readonly trainTripId: string, readonly intineraryId: string) {
    super()
    assert.isNotNull({ trainTripId, intineraryId })
  }
}
