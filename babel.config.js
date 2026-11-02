module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // WatermelonDB models use legacy decorators (@field, @children, ...)
  plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
};
