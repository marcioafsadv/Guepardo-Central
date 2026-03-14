/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                guepardo: {
                    accent: '#D35400',
                    orange: '#E67E22',
                    dark: '#1a0900',
                    rust: '#8B3A0F',
                    brown: {
                        light: '#5C240A',
                        dark: '#1D0B04',
                    }
                },
                warm: {
                    900: '#2C2621',
                }
            },
            backgroundImage: {
                'brand-gradient': 'linear-gradient(135deg, #FF6B00 0%, #E67E22 100%)',
                'brand-gradient-premium': 'linear-gradient(135deg, #5C240A 0%, #1D0B04 100%)',
            },
            boxShadow: {
                'glow': '0 0 15px rgba(211, 84, 0, 0.3)',
                'glow-intense': '0 0 25px rgba(255, 107, 0, 0.6), 0 0 10px rgba(255, 107, 0, 0.4)',
            }
        },
    },
    plugins: [],
}
