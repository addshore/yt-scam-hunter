module.exports = {
  "root": true,
  "env": {
    es2017: true,
    node: true,
    mocha: true,
  },
  "extends": [
    "eslint:recommended",
    "google",
  ],
  "rules": {
    "quotes": ["error", "double"],
    "max-len": "off",
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
  },
  "globals": {
    "fetch": false,
    "globalThis": false,
  },
};
