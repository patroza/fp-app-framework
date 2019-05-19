module.exports = function (wallaby) {
  return {
    files: [
      'src/**/*.ts',
      'sample/src/**/*.ts',
      { pattern: 'src/**/*.test.ts', ignore: true },
      { pattern: 'sample/src/**/*.test.ts', ignore: true },
    ],

    tests: [
      'src/**/*.test.ts',
      'sample/src/**/*.test.ts'
    ],
    // for node.js tests you need to set env property as well
    // https://wallabyjs.com/docs/integration/node.html
    env: {
      type: 'node',
      runner: 'node'
    },

    testFramework: 'jest'
  };
};