const mix = require('laravel-mix');
const library = 'DataLayerCop';

mix.options({
  terser: {
    extractComments: false,
    terserOptions: {
      format: {
        comments: /^\*!/,
      },
    },
  },

});

mix.copy(`src/${library}.js`, `dist/${library}.js`);
mix.minify(`src/${library}.js`, `dist/${library}.min.js`);

mix.babel(`src/${library}.js`, `dist/${library}.babel.js`);