const path = require('path');

module.exports = {
  // Outros campos de configuração do Webpack
  entry: './src/index.js', // ou o caminho do seu arquivo de entrada
  output: {
    path: path.resolve(__dirname, 'dist'), // ou o diretório de saída desejado
    filename: 'bundle.js', // nome do arquivo gerado
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      // Adicione outras regras aqui se necessário
    ],
  },
  resolve: {
    fallback: {
      crypto: false, // Adicionando o polyfill para crypto
      // Você pode adicionar outros polyfills aqui, se necessário
    },
  },
  // Outras configurações, como plugins, devServer, etc.
};
