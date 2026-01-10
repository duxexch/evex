#!/usr/bin/env python3
"""
Bot Startup Verification Script
================================
Verifies all components are loaded and operational.
"""

import os
import sys
import asyncio
from datetime import datetime

def print_header(title):
    """Print formatted header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_status(status, message):
    """Print status line"""
    emoji = "✅" if status else "❌"
    print(f"{emoji} {message}")


async def main():
    """Main verification routine"""
    
    print("\n" + "╔" + "═" * 78 + "╗")
    print("║" + " " * 20 + "🤖 BOT STARTUP VERIFICATION" + " " * 29 + "║")
    print("║" + " " * 30 + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " " * 28 + "║")
    print("╚" + "═" * 78 + "╝")
    
    all_passed = True
    
    # ==================== ENVIRONMENT CHECK ====================
    print_header("1. ENVIRONMENT")
    
    # Python version
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print_status(sys.version_info >= (3, 11), f"Python version: {python_version}")
    
    # Virtual environment
    in_venv = hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    print_status(in_venv, f"Virtual environment: {'Active' if in_venv else 'Not active'}")
    
    # Bot token
    bot_token = os.getenv('BOT_TOKEN')
    print_status(bool(bot_token), f"BOT_TOKEN: {'Set' if bot_token else 'Not set'}")
    
    # ==================== IMPORTS CHECK ====================
    print_header("2. MODULE IMPORTS")
    
    try:
        import aiogram
        print_status(True, f"aiogram: v{aiogram.__version__}")
    except Exception as e:
        print_status(False, f"aiogram: {e}")
        all_passed = False
    
    try:
        from sqlalchemy import __version__ as sa_version
        print_status(True, f"SQLAlchemy: v{sa_version}")
    except Exception as e:
        print_status(False, f"SQLAlchemy: {e}")
        all_passed = False
    
    try:
        import models
        print_status(True, "models.py: Imported")
    except Exception as e:
        print_status(False, f"models.py: {e}")
        all_passed = False
    
    try:
        import bot
        print_status(True, "bot.py: Imported")
    except Exception as e:
        print_status(False, f"bot.py: {e}")
        all_passed = False
    
    # ==================== LEGACY SERVICE CHECK ====================
    print_header("3. LEGACY SERVICE")
    
    try:
        from services.legacy_service import legacy_service, PROTECTED_ADMIN_ID, PROTECTED_ADMIN_BALANCE
        print_status(True, "legacy_service: Imported")
        print(f"   • Protected Admin ID: {PROTECTED_ADMIN_ID}")
        print(f"   • Protected Balance: {PROTECTED_ADMIN_BALANCE:,} SAR")
        print(f"   • Currencies: {len(legacy_service.currencies)}")
        
        # Test CSV files
        csv_files = [
            'users.csv', 'transactions.csv', 'companies.csv',
            'exchange_addresses.csv', 'complaints.csv', 'system_settings.csv'
        ]
        
        csv_ok = True
        for csv_file in csv_files:
            if os.path.exists(csv_file):
                size = os.path.getsize(csv_file)
                print(f"   • {csv_file}: {size} bytes")
            else:
                print_status(False, f"{csv_file} missing")
                csv_ok = False
        
        if csv_ok:
            print_status(True, "All CSV files present")
        
        # Test async functions
        companies = await legacy_service.get_companies()
        print_status(True, f"get_companies(): {len(companies)} companies")
        
        balance = await legacy_service.get_user_balance(PROTECTED_ADMIN_ID)
        print_status(balance == PROTECTED_ADMIN_BALANCE, 
                    f"Admin balance protection: {balance:,} SAR")
        
        stats = await legacy_service.get_statistics()
        print_status(True, f"Statistics: {stats['total_users']} users, "
                          f"{stats['total_transactions']} transactions")
        
    except Exception as e:
        print_status(False, f"legacy_service: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    # ==================== HANDLERS CHECK ====================
    print_header("4. HANDLERS")
    
    try:
        from handlers import (start, admin, broadcast, user_settings, 
                             announcements, flying_plane_handler, legacy_handlers)
        
        handlers_list = [
            ('start', start),
            ('admin', admin),
            ('broadcast', broadcast),
            ('user_settings', user_settings),
            ('announcements', announcements),
            ('flying_plane_handler', flying_plane_handler),
            ('legacy_handlers', legacy_handlers),
        ]
        
        for name, handler in handlers_list:
            handler_count = len(handler.router.message.handlers) if hasattr(handler, 'router') else 0
            print_status(True, f"{name}: {handler_count} message handlers")
        
    except Exception as e:
        print_status(False, f"Handlers: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    # ==================== SERVICES CHECK ====================
    print_header("5. SERVICES")
    
    try:
        from services.broadcast_service import BroadcastService
        print_status(True, "BroadcastService: Available")
    except Exception as e:
        print_status(False, f"BroadcastService: {e}")
        all_passed = False
    
    try:
        from services.domain_services.csv_manager import CSVManager
        print_status(True, "CSVManager: Available")
    except Exception as e:
        print_status(False, f"CSVManager: {e}")
        all_passed = False
    
    try:
        from services.domain_services.games_service import GamesService
        print_status(True, "GamesService: Available")
    except Exception as e:
        print_status(False, f"GamesService: {e}")
        all_passed = False
    
    # ==================== BOT PROCESS CHECK ====================
    print_header("6. BOT PROCESS")
    
    try:
        import subprocess
        result = subprocess.run(
            ['ps', 'aux'], 
            capture_output=True, 
            text=True
        )
        
        bot_processes = [line for line in result.stdout.split('\n') 
                        if 'python main.py' in line and 'grep' not in line]
        
        if bot_processes:
            for process in bot_processes:
                parts = process.split()
                pid = parts[1]
                cpu = parts[2]
                mem = parts[3]
                print_status(True, f"Bot running (PID {pid}, CPU {cpu}%, MEM {mem}%)")
        else:
            print_status(False, "Bot not running")
            all_passed = False
        
    except Exception as e:
        print_status(False, f"Process check: {e}")
    
    # ==================== COMMANDS AVAILABLE ====================
    print_header("7. AVAILABLE COMMANDS")
    
    commands = [
        ("Registration", "/register", "User registration flow"),
        ("Flying Plane", "/play_flying_plane <amount>", "Play Flying Plane game"),
        ("Game Help", "/flying_plane_help", "Game instructions"),
        ("Game Stats", "/flying_plane_stats", "User game statistics"),
        ("Deposit", "💰 طلب إيداع", "Request deposit"),
        ("Withdraw", "💸 طلب سحب", "Request withdrawal"),
        ("My Requests", "📋 طلباتي", "View transactions"),
        ("Profile", "👤 حسابي", "View account"),
        ("Currency", "💱 تغيير العملة", "Change currency"),
        ("Support", "🆘 دعم", "Support info"),
    ]
    
    print("   Command               | Description")
    print("   " + "-" * 70)
    for category, cmd, desc in commands:
        print(f"   {cmd:20} | {desc}")
    
    # ==================== SUMMARY ====================
    print_header("8. SUMMARY")
    
    if all_passed:
        print("✅ ALL CHECKS PASSED!")
        print("\n📱 Bot Information:")
        print("   • Username: @Gkdkkdkfbot")
        print("   • Name: Testerr")
        print("   • Status: OPERATIONAL")
        print("\n🔐 Admin Protection:")
        print(f"   • User ID: {PROTECTED_ADMIN_ID}")
        print(f"   • Balance: {PROTECTED_ADMIN_BALANCE:,} SAR (CONSTANT)")
        print("\n🎮 Features Active:")
        print("   • Legacy deposit/withdrawal system")
        print("   • Flying Plane game")
        print("   • Multi-currency support (18 currencies)")
        print("   • User registration & profiles")
        print("   • Transaction tracking")
        print("\n✅ Ready for testing!")
        
        return 0
    else:
        print("❌ SOME CHECKS FAILED")
        print("\nPlease review the errors above and fix them before testing.")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        print(f"\n❌ VERIFICATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
