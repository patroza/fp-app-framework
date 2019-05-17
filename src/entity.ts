import generateUuid from './utils/generateUuid'

export default abstract class Entity {
  public readonly id: string = generateUuid()
  private readonly _EVENTS = [] as any[]

  protected registerDomainEvent(evt: any) {
    this._EVENTS.push(evt)
  }
}
