import { generateShortUuid } from "./utils/generateUuid"

export default abstract class Event {
  readonly id = generateShortUuid()
  readonly createdAt = new Date()
}
