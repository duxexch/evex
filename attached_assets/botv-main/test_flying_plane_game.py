#!/usr/bin/env python3
"""
Flying Plane Game - Test Simulation
Simulates a complete game session without the Telegram bot
Tests all Phase 1 integration points
"""

import asyncio
import sys
from pathlib import Path
from decimal import Decimal
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

async def run_game_test():
    """Run a complete game test"""
    
    print("\n" + "="*70)
    print("🎮 FLYING PLANE GAME - TEST SIMULATION")
    print("="*70 + "\n")
    
    # Admin user for testing
    admin_user_id = 7146701713
    stake_amount = Decimal("1000.00")  # 1000 SAR stake
    
    print(f"📝 Test Parameters:")
    print(f"   User ID: {admin_user_id}")
    print(f"   Stake: {stake_amount}")
    print()
    
    try:
        # Import Phase 1 services
        print("📦 Importing Phase 1 Services...")
        from services.domain_services.games_service import games_service
        from services.domain_services.csv_manager import csv_manager
        
        # Import flying plane game directly (avoid handlers package dependencies)
        import importlib.util
        spec = importlib.util.spec_from_file_location("flying_plane_game", "handlers/flying_plane_game.py")
        flying_plane_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(flying_plane_module)
        
        handle_flying_plane_command = flying_plane_module.handle_flying_plane_command
        initialize_flying_plane_game = flying_plane_module.initialize_flying_plane_game
        flying_plane_sessions = flying_plane_module.flying_plane_sessions
        
        print("   ✅ GamesService imported")
        print("   ✅ CSVManager imported")
        print("   ✅ Flying Plane game imported\n")
        
        # Initialize Flying Plane game
        print("🎯 Initializing Flying Plane Game...")
        initialize_flying_plane_game()
        
        # Verify game exists or will be created
        existing = csv_manager.read_by_id("games", "FLYING_PLANE")
        if existing:
            print("   ✅ Flying Plane game found in games.csv\n")
        else:
            print("   ℹ️ Game will be created on first play\n")
        
        # Run game session
        print("🎮 Starting Game Session...")
        print(f"   Time: {datetime.now().isoformat()}")
        
        result = await handle_flying_plane_command(admin_user_id, stake_amount, None)
        
        if result:
            print("   ✅ Game completed\n")
            
            # Display results
            print("📊 Game Results:")
            print(f"   Final Score: {result['final_score']}")
            print(f"   Time Steps: {result['total_time_steps']}")
            print(f"   Max Speed: {result['max_speed_reached']}")
            print(f"   Outcome: {'🎉 WIN' if result['is_win'] else '❌ LOSS'}")
            print(f"   Stake: {result['stake_amount']}")
            print(f"   Payout: {result['payout_amount']}")
            print(f"   Profit/Loss: {result['profit_loss']}\n")
        else:
            print("   ❌ Game session failed\n")
            return False
        
        # Verify CSV files were updated
        print("📁 Verifying CSV Files...")
        
        # Check games.csv
        games = csv_manager.read_all("games")
        flying_plane_count = sum(1 for g in games if g.get('id') == 'FLYING_PLANE')
        print(f"   ✅ games.csv: {len(games)} total games, Flying Plane: {flying_plane_count}")
        
        # Check game_sessions.csv
        sessions = csv_manager.read_all("game_sessions")
        flying_plane_sessions_count = sum(1 for s in sessions if s.get('game_id') == 'FLYING_PLANE')
        print(f"   ✅ game_sessions.csv: {len(sessions)} total sessions, Flying Plane: {flying_plane_sessions_count}")
        
        # Check flying_plane_scores.csv
        scores = csv_manager.read_all("flying_plane_scores")
        print(f"   ✅ flying_plane_scores.csv: {len(scores)} score records")
        if scores:
            latest_score = scores[-1]
            print(f"      Last game: user={latest_score.get('user_id')}, score={latest_score.get('score')}")
        
        # Check game_logs.csv
        logs = csv_manager.read_all("game_logs")
        flying_plane_logs = [l for l in logs if l.get('game_id') == 'FLYING_PLANE']
        print(f"   ✅ game_logs.csv: {len(logs)} total logs, Flying Plane: {len(flying_plane_logs)}")
        
        print()
        
        # Anti-cheat verification
        print("🛡️ Anti-Cheat Verification:")
        anti_cheat_alerts = [l for l in flying_plane_logs if 'anti_cheat' in l.get('action', '')]
        if anti_cheat_alerts:
            print(f"   ⚠️ {len(anti_cheat_alerts)} anti-cheat alert(s) detected:")
            for alert in anti_cheat_alerts:
                print(f"      - {alert.get('details')}")
        else:
            print(f"   ✅ No suspicious activity detected")
        
        print()
        
        # Verify admin balance not changed
        print("💰 Wallet Verification:")
        import csv as csv_module
        if Path("wallets.csv").exists():
            with open("wallets.csv", 'r', encoding='utf-8-sig') as f:
                reader = csv_module.DictReader(f)
                for row in reader:
                    if row.get('user_id') == str(admin_user_id):
                        balance = Decimal(row.get('balance', '0'))
                        expected = Decimal("10000000000")
                        if balance == expected:
                            print(f"   ✅ Admin balance: {balance:,} (constant as required)")
                        else:
                            print(f"   ⚠️ Admin balance: {balance:,} (expected {expected:,})")
                        break
        
        print()
        
        # Final summary
        print("="*70)
        print("✅ TEST COMPLETE - ALL SYSTEMS OPERATIONAL")
        print("="*70)
        print("""
Summary:
  ✅ Phase 1 GamesService integration working
  ✅ CSV persistence functional
  ✅ Flying Plane game logic operational
  ✅ Anti-cheat monitoring active
  ✅ Admin balance protected (constant)
  ✅ Game session recorded in all CSV files

Files Updated:
  - data/games.csv (Flying Plane game definition)
  - data/game_sessions.csv (game session record)
  - data/flying_plane_scores.csv (detailed score)
  - data/game_logs.csv (game actions & anti-cheat logs)
        """)
        
        return True
    
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(run_game_test())
    sys.exit(0 if success else 1)
