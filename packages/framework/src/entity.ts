import Event from "./event"
import { Writeable } from "./utils"
import generateUuid from "./utils/generateUuid"

export default abstract class Entity {
  readonly id: string = generateUuid()
  private _EVENTS: Event[] = []

  // workaround so that we can make props look readonly on the outside, but allow to change on the inside.
  // doesn't work if assigned as property :/
  constructor() { Object.defineProperty(this, "w", { value: this }) }
  protected get w() { return this as Writeable<this> }

  readonly intGetAndClearEvents = () => {
    const events = this._EVENTS
    this._EVENTS = []
    return events
  }

  protected registerDomainEvent(evt: Event) {
    this._EVENTS.push(evt)
  }
}
