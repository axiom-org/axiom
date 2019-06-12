module.exports = {
  roots: ["<rootDir>/src/browser", "<rootDir>/src/iso"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.browser.json"
    }
  }
};
