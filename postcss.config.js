module.exports = {
    plugins: [
      require('postcss-import'),
      require('autoprefixer'),
      require('@fullhuman/postcss-purgecss')({
        content: ['./*.html', './js/*.js'], // Adjust the paths to your HTML and JS files
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
      }),
      require('cssnano')({
        preset: 'default',
      }),
    ]
  }
  