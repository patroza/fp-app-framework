import generateUuid from "./utils/generateUuid"

export default abstract class Entity {
  readonly id: string = generateUuid()
  private _EVENTS: any[] = []

  readonly intGetAndClearEvents = () => {
    const events = this._EVENTS
    this._EVENTS = []
    return events
  }

  protected registerDomainEvent(evt: any) {
    this._EVENTS.push(evt)
  }
}
