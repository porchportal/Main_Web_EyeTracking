module.exports = {
    content: [
      "./pages/**/*.{js,ts,jsx,tsx}",
      "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          'roboto': ['Roboto', 'sans-serif'],
        },
        colors: {
          'mint-green': 'rgba(124, 255, 218, 0.5)',
          'mint-green-dark': 'rgba(124, 255, 218, 0.7)',
          'mint-green-solid': 'rgba(124, 255, 183, 1)',
          'mint-green-light': 'rgba(124, 255, 183, 0.3)',
        },
      },
    },
    plugins: [],
  }