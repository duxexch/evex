# Quick Start Guide - LangSense Mobile App

This guide will help you set up and run the LangSense mobile application with the FastAPI backend.

## Prerequisites

- Python 3.8+ (for backend)
- Node.js 14+ and npm (for mobile app)
- Git

## Setup Instructions

### 1. Clone and Setup Backend

```bash
# Clone the repository
git clone https://github.com/promnes/TaskFlowAI-.git
cd TaskFlowAI-

# Install Python dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env and configure your settings
# At minimum, set:
# - BOT_TOKEN=dummy-token-for-api-mode (for API-only)
# - JWT_SECRET_KEY=your-secret-key
# - ADMIN_USER_IDS=your-telegram-user-id
```

### 2. Start the Backend API

```bash
# Run the FastAPI server
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Alternative Docs: http://localhost:8000/redoc

### 3. Setup Mobile App

```bash
# Navigate to mobile app directory
cd mobile-app

# Install dependencies
npm install

# Configure API endpoint
# Edit src/constants/config.js and update API_BASE_URL
# For local development:
# export const API_BASE_URL = 'http://localhost:8000/api/v1';
# For Android emulator:
# export const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';
```

### 4. Run the Mobile App

```bash
# Start Expo development server
npm start

# Then choose:
# - Press 'w' to open in web browser
# - Press 'a' to open in Android emulator
# - Press 'i' to open in iOS simulator (macOS only)
# - Scan QR code with Expo Go app on your phone
```

## Testing the App

### 1. Register a New User

1. Open the mobile app
2. Click "Register"
3. Fill in:
   - Phone number (e.g., +966501234567)
   - First name
   - Last name (optional)
4. Click "Register"
5. You'll receive a customer code

### 2. Test Features

- **Deposit**: Navigate to Home → Deposit
- **Withdraw**: Navigate to Home → Withdraw
- **Complaints**: Navigate to Home → Complaint
- **Transactions**: Check the Transactions tab
- **Profile**: View and update your profile in the Profile tab

## API Endpoints Quick Reference

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login

### Financial Services
- `POST /api/v1/financial/deposit` - Create deposit
- `POST /api/v1/financial/withdraw` - Create withdrawal
- `POST /api/v1/financial/complaint` - Submit complaint
- `GET /api/v1/financial/transactions` - Get transactions

### User Management
- `GET /api/v1/users/profile` - Get profile
- `PUT /api/v1/users/profile` - Update profile

## Troubleshooting

### Backend Issues

**Problem**: Module not found errors
```bash
# Solution: Install all dependencies
pip install -r requirements.txt
```

**Problem**: Database errors
```bash
# Solution: Delete the database and restart
rm langsense.db
python -m uvicorn api.main:app --reload
```

### Mobile App Issues

**Problem**: Can't connect to API
```bash
# Solution: Check API_BASE_URL in src/constants/config.js
# For Android emulator, use: http://10.0.2.2:8000/api/v1
# For iOS simulator, use: http://localhost:8000/api/v1
# For physical device, use your computer's IP: http://192.168.x.x:8000/api/v1
```

**Problem**: Dependencies installation failed
```bash
# Solution: Clear cache and reinstall
cd mobile-app
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

1. **Hot Reload**: Both backend and mobile app support hot reload
2. **API Documentation**: Always check http://localhost:8000/docs for latest API
3. **Logs**: Check console output for debugging
4. **Database**: SQLite database is stored as `langsense.db` in root directory

## Production Deployment

### Backend (FastAPI)

```bash
# Install production server
pip install gunicorn

# Run with Gunicorn
gunicorn api.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Mobile App

```bash
# Build for Android
cd mobile-app
expo build:android

# Build for iOS (requires macOS)
expo build:ios
```

## Security Notes

- Change `JWT_SECRET_KEY` in production
- Use PostgreSQL instead of SQLite for production
- Configure CORS properly for production
- Use HTTPS in production
- Store sensitive data securely

## Need Help?

- Check API docs: http://localhost:8000/docs
- Review mobile app README: mobile-app/README.md
- Check main documentation: MOBILE_APP.md

## Features

✅ User registration and authentication
✅ Deposit requests
✅ Withdrawal requests
✅ Complaint submission
✅ Transaction history
✅ Multi-language support (Arabic/English)
✅ Binance-inspired dark UI
✅ RTL support for Arabic
✅ Profile management

Enjoy using LangSense! 🚀
