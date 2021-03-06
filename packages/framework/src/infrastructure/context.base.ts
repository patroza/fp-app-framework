import { PipeFunction, PipeFunctionN, Result } from "@fp-app/neverthrow-extensions"
import Event from "../event"
import { Disposable } from "../utils"
import DomainEventHandler from "./domainEventHandler"
import { DbError } from "./errors"
import { autoinject } from "./SimpleContainer"

// tslint:disable-next-line:max-classes-per-file
@autoinject
export default abstract class ContextBase implements Disposable {
  private disposed = false

  constructor(private readonly eventHandler: DomainEventHandler) {}

  readonly save = (): Promise<Result<void, DbError | Error>> => {
    if (this.disposed) {
      throw new Error("The context is already disposed")
    }
    return this.eventHandler.commitAndPostEvents(() => this.getAndClearEvents(), () => this.saveImpl())
  }

  dispose() {
    this.disposed = true
  }

  protected abstract getAndClearEvents(): Event[]

  protected abstract async saveImpl(): Promise<Result<void, DbError>>
}

export interface UnitOfWork extends Disposable {
  save: PipeFunctionN<void, DbError | Error>
}

export interface RecordContext<T> {
  add: (record: T) => void
  remove: (record: T) => void
  load: PipeFunction<string, T, DbError>
}
