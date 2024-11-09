const webpack = require('webpack');
const path = require('path');

module.exports = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      path: path.resolve(__dirname, 'src/path-browserify'), // Ajuste do path se necessário
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      stream: require.resolve('stream-browserify'),
      util: require.resolve('util'), // Adicionando fallback para util
    };

    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      })
    );

    return config;
  },
};
