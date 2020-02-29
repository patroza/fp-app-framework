import invariant from "invariant"

interface Assert {
  (testValue: boolean, format: string, ...extra: any[]): void
  isNotNull: (object: any) => void
}

/**
 * Throws invariant error with format as text when testValue is Falsey
 * @param {*} testValue
 * @param {String} format
 * @param {...extra} extra
 */
const assert = ((testValue: boolean, format: string, ...extra) =>
  invariant(testValue, format, ...extra)) as Assert

/**
 * Asserts that any of the specified properties are not null
 * @param {Object} properties
 */
const propertiesAreNotNull = (properties: { [key: string]: any }) => {
  for (const prop of Object.keys(properties)) {
    isNotNull(properties[prop], prop)
  }
}

/**
 * Asserts that value is not null
 * @param {*} value
 * @param {string} name
 */
const isNotNull = (value: any, name: string) =>
  invariant(value != null, `${name} must not be null`)

assert.isNotNull = propertiesAreNotNull

export default assert
