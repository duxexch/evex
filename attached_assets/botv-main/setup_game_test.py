#!/usr/bin/env python3
"""
Game Test Setup Script
- Initializes admin user with test balance
- Registers Flying Plane game
- Prepares CSV files for testing
"""

import csv
import os
import sys
from pathlib import Path
from decimal import Decimal
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

def setup_admin_user():
    """Ensure admin user has required balance in users.csv"""
    
    users_file = "users.csv"
    admin_user_id = 7146701713  # From .env ADMIN_USER_IDS
    test_balance = Decimal("10000000000")  # 10 billion for testing
    
    print(f"\n📋 SETTING UP ADMIN USER")
    print(f"   User ID: {admin_user_id}")
    print(f"   Test Balance: {test_balance:,}")
    
    # Check if users.csv exists and has admin user
    if os.path.exists(users_file):
        with open(users_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            admin_found = False
            rows = []
            
            for row in reader:
                if row.get('telegram_id') == str(admin_user_id):
                    admin_found = True
                    print(f"   ✅ Admin user found: {row.get('name', 'Unknown')}")
                rows.append(row)
            
            # Add admin if not found
            if not admin_found:
                print(f"   ⚠️ Admin user not found, creating...")
                rows.append({
                    'telegram_id': str(admin_user_id),
                    'name': 'Test Admin',
                    'phone': '+966501234567',
                    'customer_id': f'TEST_{admin_user_id}',
                    'language': 'ar',
                    'date': datetime.now().isoformat(),
                    'is_banned': 'no',
                    'ban_reason': '',
                    'currency': 'SAR'
                })
            
            # Write back
            if rows and 'telegram_id' in rows[0]:
                with open(users_file, 'w', newline='', encoding='utf-8-sig') as fw:
                    fieldnames = ['telegram_id', 'name', 'phone', 'customer_id', 'language', 'date', 'is_banned', 'ban_reason', 'currency']
                    writer = csv.DictWriter(fw, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                print(f"   ✅ users.csv updated")
    else:
        print(f"   ⚠️ users.csv not found")


def initialize_games_service():
    """Initialize Games Service and Flying Plane game"""
    
    print(f"\n📦 INITIALIZING GAMES SERVICE")
    
    try:
        from services.domain_services.games_service import games_service
        from services.domain_services.csv_manager import csv_manager
        
        print(f"   ✅ GamesService imported")
        
        # Check if Flying Plane game exists
        existing = csv_manager.read_by_id("games", "FLYING_PLANE")
        
        if existing:
            print(f"   ✅ Flying Plane game already exists")
        else:
            print(f"   ⚠️ Flying Plane game not found, creating...")
            # Note: We'll create it during actual gameplay since we need async
            print(f"   ℹ️ Game will be auto-created on first play")
        
        # Create flying_plane_scores CSV
        if not csv_manager.file_exists("flying_plane_scores"):
            csv_manager.create_file(
                "flying_plane_scores",
                ["session_id", "user_id", "score", "time_steps", "payout_percent", "is_win", "created_date"]
            )
            print(f"   ✅ flying_plane_scores.csv created")
        else:
            print(f"   ✅ flying_plane_scores.csv exists")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    return True


def create_test_wallet():
    """Create wallet file for test user"""
    
    print(f"\n💰 CREATING TEST WALLET")
    
    wallet_file = "wallets.csv"
    admin_user_id = 7146701713
    test_balance = 10000000000
    
    # Check if wallets file exists
    if not os.path.exists(wallet_file):
        print(f"   ⚠️ wallets.csv not found, creating...")
        with open(wallet_file, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['user_id', 'balance', 'currency', 'last_updated'])
            writer.writerow([admin_user_id, test_balance, 'SAR', datetime.now().isoformat()])
        print(f"   ✅ wallets.csv created with test balance")
    else:
        # Update or add wallet entry
        with open(wallet_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            wallets = list(reader)
        
        # Check if admin wallet exists
        admin_wallet_found = False
        for wallet in wallets:
            if wallet.get('user_id') == str(admin_user_id):
                wallet['balance'] = test_balance
                wallet['last_updated'] = datetime.now().isoformat()
                admin_wallet_found = True
                print(f"   ✅ Admin wallet updated: {test_balance:,}")
                break
        
        if not admin_wallet_found:
            wallets.append({
                'user_id': admin_user_id,
                'balance': test_balance,
                'currency': 'SAR',
                'last_updated': datetime.now().isoformat()
            })
            print(f"   ✅ Admin wallet created: {test_balance:,}")
        
        # Write back
        with open(wallet_file, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=['user_id', 'balance', 'currency', 'last_updated'])
            writer.writeheader()
            writer.writerows(wallets)


def main():
    """Main setup routine"""
    
    print("=" * 70)
    print("🎮 FLYING PLANE GAME - TEST SETUP")
    print("=" * 70)
    
    # Step 1: Setup admin user
    setup_admin_user()
    
    # Step 2: Initialize GamesService
    if not initialize_games_service():
        print("\n❌ Failed to initialize GamesService")
        return False
    
    # Step 3: Create test wallet
    create_test_wallet()
    
    # Step 4: Summary
    print("\n" + "=" * 70)
    print("✅ TEST SETUP COMPLETE")
    print("=" * 70)
    print("""
Next Steps:
1. Start the bot: python comprehensive_bot.py
2. Send /start command to bot
3. Send /play_flying_plane command (when implemented)
4. Game will play automatically for 20 turns
5. Check CSV files for game results

Test Files:
- users.csv (admin user)
- data/games.csv (Flying Plane game)
- data/game_sessions.csv (game results)
- data/flying_plane_scores.csv (detailed scores)
- data/game_logs.csv (anti-cheat logs)
    """)
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
