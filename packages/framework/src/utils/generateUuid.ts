import short from "short-uuid"
import { v4 } from "uuid"

const generateUuid = () => v4()
export default generateUuid

const translator = short()
export const generateShortUuid = translator.generate.bind(translator)
export const convertToShortUuid = translator.fromUUID.bind(translator)
export const convertToUuid = translator.toUUID.bind(translator)
