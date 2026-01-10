# LangSense Mobile App

A Binance-inspired mobile application for LangSense financial services platform. Built with React Native and Expo.

## Features

- 🎨 **Binance-like Dark UI**: Professional dark theme inspired by cryptocurrency exchanges
- 🌐 **Multi-language Support**: Arabic (RTL) and English
- 💰 **Financial Services**: Deposits, withdrawals, and complaint handling
- 📊 **Transaction History**: Track all your financial activities
- 👤 **User Profile**: Manage account settings and preferences
- 🔐 **Secure Authentication**: JWT-based authentication system
- 📱 **Cross-platform**: Works on iOS and Android

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for macOS) or Android Emulator

## Installation

1. Navigate to the mobile-app directory:
```bash
cd mobile-app
```

2. Install dependencies:
```bash
npm install
```

3. Configure the API endpoint:
Edit `src/constants/config.js` and update the `API_BASE_URL` to point to your backend server.

## Running the App

### Start the development server:
```bash
npm start
```

### Run on specific platforms:
```bash
# iOS (macOS only)
npm run ios

# Android
npm run android

# Web
npm run web
```

## Project Structure

```
mobile-app/
├── src/
│   ├── screens/          # Screen components
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── HomeScreen.js
│   │   ├── TransactionsScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── DepositScreen.js
│   │   ├── WithdrawScreen.js
│   │   └── ComplaintScreen.js
│   ├── navigation/       # Navigation configuration
│   ├── components/       # Reusable components
│   ├── services/         # API services
│   ├── constants/        # Theme and configuration
│   ├── i18n/            # Internationalization
│   └── utils/           # Utility functions
├── assets/              # Images, fonts, etc.
└── App.js              # Main app component
```

## Design System

The app uses a Binance-inspired design system with:

- **Color Scheme**: Dark background (#0B0E11) with gold accents (#F0B90B)
- **Typography**: Clean, modern fonts with proper hierarchy
- **Components**: Card-based layouts with consistent spacing
- **Status Colors**: 
  - Green (#0ECB81) for positive/success
  - Red (#F6465D) for negative/danger
  - Yellow (#F0B90B) for warnings/pending

## API Integration

The app communicates with the FastAPI backend through REST endpoints:

- `/api/v1/auth` - Authentication (login, register)
- `/api/v1/users` - User profile management
- `/api/v1/financial` - Financial services (deposit, withdraw, complaints)
- `/api/v1/settings` - App settings (languages, countries)
- `/api/v1/admin` - Admin panel (for authorized users)

## Building for Production

### iOS:
```bash
expo build:ios
```

### Android:
```bash
expo build:android
```

## Customization

### Changing Colors:
Edit `src/constants/theme.js` to customize the color scheme.

### Adding Languages:
Add translations to `src/i18n/translations.js` and update the supported languages list.

### Modifying API Endpoints:
Update `src/constants/config.js` with your API configuration.

## License

This project is part of the LangSense platform.
