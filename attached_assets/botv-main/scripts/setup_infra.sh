#!/bin/bash

# LangSense Infrastructure Setup Script
# This script sets up the entire infrastructure for development

set -e

echo "================================"
echo "  LangSense Infrastructure Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your configuration."
    echo ""
fi

# Create SSL certificates directory
if [ ! -d ssl ]; then
    echo "🔐 Creating SSL certificates directory..."
    mkdir -p ssl
    
    # Generate self-signed certificate for development
    openssl req -x509 -newkey rsa:4096 -nodes -out ssl/cert.pem -keyout ssl/key.pem -days 365 \
        -subj "/C=SA/ST=Riyadh/L=Riyadh/O=LangSense/CN=localhost"
    
    echo "✅ Generated self-signed SSL certificate (valid for development)"
    echo ""
fi

# Create scripts directory
mkdir -p scripts

# Make scripts executable
chmod +x scripts/init_db.sql

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose build

echo ""
echo "================================"
echo "  Infrastructure Ready!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Update .env file with your configuration"
echo "2. Run: docker-compose up -d"
echo "3. Access the API at: http://localhost:8000/api/v1/docs"
echo "4. PostgreSQL at: localhost:5432"
echo "5. Redis at: localhost:6379"
echo ""
