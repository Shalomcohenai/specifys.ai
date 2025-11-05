export default {
  plugins: {
    'postcss-import': {},
    'autoprefixer': {},
    'cssnano': {
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeWhitespace: true,
      }],
    },
    '@fullhuman/postcss-purgecss': process.env.NODE_ENV === 'production' ? {
      content: [
        './**/*.html',
        './**/*.md',
        './_includes/**/*.html',
        './_layouts/**/*.html',
        './pages/**/*.html',
        './assets/js/**/*.js',
      ],
      safelist: [
        /^fa-/,
        /^mermaid/,
        /^hljs/,
        /^theme-/,
        /data-theme/,
        /js-/,
        /is-/,
        /has-/,
        /active/,
        /loaded/,
        /error/,
        /success/,
        /warning/,
      ],
      defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
    } : false,
  },
};
