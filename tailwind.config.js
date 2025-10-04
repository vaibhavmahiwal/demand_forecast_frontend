module.exports = {
  // CRITICAL: Ensure Tailwind scans all JavaScript/React files in your source directory.
  // This configuration covers all .js and .jsx files recursively within the 'src' folder.
  content: [
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};