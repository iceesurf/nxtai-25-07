export default {
  plugins: {
    // Import CSS files and inline them
    'postcss-import': {},
    
    // Tailwind CSS processing
    tailwindcss: {},
    
    // Add vendor prefixes automatically
    autoprefixer: {},
    
    // Optimize CSS for production
    ...(process.env.NODE_ENV === 'production' && {
      cssnano: {
        preset: [
          'default',
          {
            // Preserve important comments
            discardComments: { removeAll: false },
            // Don't minify calc() expressions
            calc: false,
            // Preserve custom properties
            normalizeWhitespace: { exclude: false },
          },
        ],
      },
    }),
  },
};