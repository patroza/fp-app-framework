module.exports = function (wallaby) {
  return {
    files: [
      '**/*.ts',
      { pattern: '**/*.test.ts', ignore: true },
      { pattern: 'node_modules', ignore: true }
    ],

    tests: [
      '**/*.test.ts',
      { pattern: 'node_modules', ignore: true }
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