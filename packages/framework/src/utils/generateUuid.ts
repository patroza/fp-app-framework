import short from "short-uuid"
import { v4 } from "uuid"

const generateUuid = () => v4()
export default generateUuid

const translator = short()
export const generateShortUuid = translator.generate
export const convertToShortUuid = translator.fromUUID
export const convertToUuid = translator.toUUID
