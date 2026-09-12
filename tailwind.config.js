// Tailwind is compiled once into css/site.css (npm run build:css) instead of
// being generated in the browser by the 300 KB cdn.tailwindcss.com script.
// Every file that contains class names must be listed here, including the
// generator templates in scripts/ and the JS that toggles classes at runtime.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './blog/*.html',
    './area/*.html',
    './tools/*.html',
    './scripts/*.mjs',
    './js/*.js',
  ],
  theme: {
    extend: {
      // Mirrors the inline tailwind.config the homepage used with the CDN build.
      fontFamily: {
        hind: ['"Noto Sans Bengali"', 'sans-serif'],
        noto: ['"Noto Serif Bengali"', 'sans-serif'],
        sys: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Oxygen-Sans', 'Ubuntu', 'Cantarell', '"Helvetica Neue"', 'sans-serif'],
      },
    },
  },
};
