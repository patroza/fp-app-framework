import generateUuid from './utils/generateUuid'

export default abstract class Entity {
  readonly id: string = generateUuid()
  private readonly _EVENTS = [] as any[]

  protected registerDomainEvent(evt: any) {
    this._EVENTS.push(evt)
  }
}
