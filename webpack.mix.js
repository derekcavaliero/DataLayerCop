const mix = require('laravel-mix');

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

const library = 'DataLayerCop';

mix.setPublicPath('dist');

mix.babel(`src/${library}.js`, `dist/${library}.babel.js`);
mix.minify(`src/${library}.js`, `dist/${library}.js`);