import { generateShortUuid } from "./utils"

export default abstract class Event {
  readonly id = generateShortUuid()
  readonly createdAt = new Date()
}
