import Event from "./event"
import generateUuid from "./utils/generateUuid"

export default abstract class Entity {
  readonly id: string = generateUuid()
  private _EVENTS: Event[] = []

  readonly intGetAndClearEvents = () => {
    const events = this._EVENTS
    this._EVENTS = []
    return events
  }

  protected registerDomainEvent(evt: Event) {
    this._EVENTS.push(evt)
  }
}
