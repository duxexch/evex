# LangSense - Mobile Application & API

LangSense has been transformed from a Telegram bot into a full-featured mobile application with a Binance-inspired design. The project now consists of:

1. **FastAPI Backend** - REST API server
2. **React Native Mobile App** - Cross-platform mobile application
3. **Original Telegram Bot** - Legacy bot functionality (preserved)

## 🏗️ Architecture

### Backend (FastAPI)
- RESTful API with JWT authentication
- Async SQLAlchemy ORM
- Support for SQLite and PostgreSQL
- Comprehensive endpoint coverage for all features

### Mobile App (React Native + Expo)
- Binance-inspired dark UI theme
- Multi-language support (Arabic RTL + English)
- Cross-platform (iOS, Android, Web)
- Secure authentication flow
- Financial services management

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your configuration

# Run the FastAPI server
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### 2. Mobile App Setup

```bash
# Navigate to mobile app directory
cd mobile-app

# Install dependencies
npm install

# Update API configuration
# Edit src/constants/config.js and set your API URL

# Start the app
npm start
```

## 📱 Mobile App Features

### User Features
- ✅ Phone number registration and login
- ✅ Customer code generation
- ✅ Multi-language interface (Arabic/English)
- ✅ Deposit requests with payment method selection
- ✅ Withdrawal requests with account details
- ✅ Complaint submission
- ✅ Transaction history viewing
- ✅ Profile management
- ✅ Settings customization

### Design
- 🎨 Binance-inspired dark theme
- 🌙 Professional cryptocurrency exchange aesthetic
- 📊 Card-based layouts
- 🎯 Intuitive navigation
- 🌍 RTL support for Arabic

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with phone number
- `GET /api/v1/auth/me` - Get current user info

### User Management
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update profile

### Financial Services
- `POST /api/v1/financial/deposit` - Create deposit request
- `POST /api/v1/financial/withdraw` - Create withdrawal request
- `POST /api/v1/financial/complaint` - Submit complaint
- `GET /api/v1/financial/transactions` - Get transaction history

### Settings
- `GET /api/v1/settings/languages` - Get available languages
- `GET /api/v1/settings/countries` - Get available countries

### Admin (Protected)
- `GET /api/v1/admin/stats` - Get admin statistics
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/requests` - Get pending requests
- `POST /api/v1/admin/broadcast` - Broadcast message

## 🎨 Design System

The mobile app uses a carefully crafted design system inspired by Binance:

### Colors
- **Background**: `#0B0E11` (Deep dark)
- **Card Background**: `#1E2329` (Slightly lighter)
- **Primary**: `#F0B90B` (Binance gold)
- **Success**: `#0ECB81` (Green for positive actions)
- **Danger**: `#F6465D` (Red for negative actions)
- **Text**: Various shades for hierarchy

### Typography
- Clear visual hierarchy
- Bold headings for important information
- Secondary text for metadata
- Proper RTL support

## 🔒 Security

- JWT-based authentication
- Secure password hashing (bcrypt)
- Token validation on all protected routes
- Input validation and sanitization
- CORS configuration for production

## 📦 Dependencies

### Backend
- FastAPI - Web framework
- SQLAlchemy - ORM
- python-jose - JWT tokens
- passlib - Password hashing
- uvicorn - ASGI server

### Mobile App
- React Native - Framework
- Expo - Development platform
- React Navigation - Navigation
- Axios - HTTP client
- i18n-js - Internationalization

## 🌍 Multi-language Support

Both the API and mobile app support:
- **Arabic** (ar) - With full RTL support
- **English** (en) - Default fallback

Users can switch languages in the app settings.

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
# Bot Configuration (for Telegram bot)
BOT_TOKEN=your_telegram_bot_token
ADMIN_USER_IDS=123456789

# Database
DATABASE_URL=sqlite+aiosqlite:///./langsense.db

# JWT Configuration (for API)
JWT_SECRET_KEY=your-secret-key-here

# App Configuration
DEFAULT_LANGUAGE=ar
DEFAULT_COUNTRY=SA
```

## 🚧 Development

### Running Both Services

Terminal 1 - Backend:
```bash
python -m uvicorn api.main:app --reload --port 8000
```

Terminal 2 - Mobile App:
```bash
cd mobile-app && npm start
```

Terminal 3 - Telegram Bot (optional):
```bash
python main.py
```

## 📊 Database Schema

The system uses the same database schema for both the bot and API:
- **Users** - User accounts and profiles
- **Languages** - Supported languages
- **Countries** - Supported countries
- **Outbox** - Requests (deposits, withdrawals, complaints)
- **Announcements** - System announcements
- **Delivery tracking** - Message delivery status

## 🎯 Migration from Bot to App

Users can:
1. Register in the mobile app with their phone number
2. Get a customer code automatically
3. Access all bot features through the mobile interface
4. Receive better UX with the Binance-like design

## 📱 Testing the App

1. Start the backend server
2. Start the mobile app
3. Register with a phone number
4. Explore the features:
   - Create deposit/withdrawal requests
   - View transactions
   - Update profile settings
   - Submit complaints

## 🤝 Contributing

When contributing:
- Follow the existing code style
- Add tests for new features
- Update documentation
- Ensure API changes are reflected in mobile app

## 📄 License

This project is part of the LangSense platform.
