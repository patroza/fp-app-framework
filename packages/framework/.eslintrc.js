const esLintConfig = require('../../.eslintrc.base')

module.exports =  {
  ...esLintConfig,
  parserOptions: {
    ...esLintConfig.parserOptions,
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  }
}
