module.exports = {
  "collectCoverage": false,
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@fp-app/framework/(.*)": "<rootDir>/../../packages/framework/src/$1",
    "^@fp-app/hosting.koa": "<rootDir>/../../packages/hosting.koa/src/index",
    "^@fp-app/io.diskdb": "<rootDir>/../../packages/io.diskdb/src/index",
    "^@fp-app/hosting.koa/(.*)": "<rootDir>/../../packages/hosting.koa/src/$1",
    "^@fp-app/io.diskdb/(.*)": "<rootDir>/../../packages/io.diskdb/src/$1",
  },
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  },
  "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  "testURL": "http://localhost:8110",
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ]
}
