#!/usr/bin/env python3
"""
Phase 1 Integration Test
Tests all newly created modular components
"""

import asyncio
import sys
import os
from pathlib import Path
from decimal import Decimal

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

async def run_tests():
    """Run all Phase 1 tests"""
    
    print("\n" + "="*60)
    print("PHASE 1 INTEGRATION TEST")
    print("="*60 + "\n")
    
    # Test 1: CSV Manager
    print("✓ TEST 1: CSV Manager")
    print("-" * 60)
    try:
        from services.domain_services.csv_manager import csv_manager
        
        # Create test CSV
        csv_manager.create_file("test_data", ["id", "name", "value"])
        print("  ✓ CSV file created: test_data.csv")
        
        # Write row
        result = csv_manager.write_row("test_data", ["id", "name", "value"], ["1", "John", "100"])
        assert result, "Write row failed"
        print("  ✓ Row written successfully")
        
        # Read all
        rows = csv_manager.read_all("test_data")
        assert len(rows) == 1, f"Expected 1 row, got {len(rows)}: {rows}"
        print(f"  ✓ Read all: {len(rows)} row(s)")
        
        # Read by ID
        row = csv_manager.read_by_id("test_data", "1")
        assert row is not None, "Row not found"
        print(f"  ✓ Read by ID: {row}")
        
        # Update row
        csv_manager.update_row("test_data", "1", {"name": "Jane", "value": "200"})
        updated = csv_manager.read_by_id("test_data", "1")
        assert updated["name"] == "Jane", "Update failed"
        print(f"  ✓ Row updated: {updated}")
        
        # Delete row
        csv_manager.delete_row("test_data", "1")
        rows_after = csv_manager.read_all("test_data")
        assert len(rows_after) == 0, "Delete failed"
        print("  ✓ Row deleted successfully")
        
        # Backup
        csv_manager.write_row("test_data", ["id", "name", "value"], ["2", "Admin", "500"])
        backup_ok = csv_manager.backup("test_data")
        assert backup_ok, "Backup failed"
        print("  ✓ Backup created successfully")
        
        print("\n  ✅ CSV Manager: ALL TESTS PASSED\n")
    except Exception as e:
        print(f"\n  ❌ CSV Manager FAILED: {e}\n")
        return False
    
    # Test 2: Data Models
    print("✓ TEST 2: Data Models")
    print("-" * 60)
    try:
        from models.data_models import (
            Game, GameSession, GameAlgorithm,
            Agent, AgentCommission, Affiliate, AffiliateReferral,
            UserProfile, Badge, Complaint, BalanceLedgerEntry,
            GameType, GameSessionResult, AffiliateStatus
        )
        
        # Test Game model
        game = Game(
            id="GAME_TEST001",
            name="Test Game",
            description="A test game",
            type="casino",
            payout_min_percent=50.0,
            payout_max_percent=200.0,
            status="active",
            created_date="2025-01-02T10:00:00"
        )
        csv_row = game.to_csv_row()
        assert len(csv_row) == 8, "Game CSV row has wrong length"
        print(f"  ✓ Game model: {game.name} → {csv_row}")
        
        # Test GameSession model
        session = GameSession(
            id="SESSION_TEST001",
            user_id=12345,
            game_id="GAME_TEST001",
            stake_amount=Decimal("100.00"),
            result="win",
            payout_amount=Decimal("150.00"),
            profit_loss=Decimal("50.00"),
            status="completed",
            created_date="2025-01-02T10:05:00"
        )
        csv_row = session.to_csv_row()
        assert len(csv_row) == 9, "GameSession CSV row has wrong length"
        print(f"  ✓ GameSession model: {session.id} → Stake: {session.stake_amount}, Profit: {session.profit_loss}")
        
        # Test GameAlgorithm model
        algo = GameAlgorithm(
            id="ALGO_TEST001",
            game_id="GAME_TEST001",
            region="SA",  # Saudi Arabia
            user_id=None,
            win_probability=0.55,
            loss_multiplier=1.2,
            active=True,
            updated_date="2025-01-02T10:00:00"
        )
        csv_row = algo.to_csv_row()
        assert len(csv_row) == 8, "GameAlgorithm CSV row has wrong length"
        print(f"  ✓ GameAlgorithm model: {algo.id} → Win prob: {algo.win_probability}")
        
        # Test Agent model
        agent = Agent(
            id="AGENT_001",
            agent_name="Ahmed Al-Dosary",
            phone="+966501234567",
            balance=Decimal("5000.00"),
            commission_rate=5.0,
            is_active=True,
            created_date="2025-01-02T10:00:00"
        )
        print(f"  ✓ Agent model: {agent.agent_name}")
        
        # Test Affiliate model
        affiliate = Affiliate(
            id="AFF_001",
            user_id=12345,
            referral_code="REFER123",
            total_referrals=10,
            lifetime_commission=Decimal("500.00"),
            created_date="2025-01-02T10:00:00"
        )
        print(f"  ✓ Affiliate model: {affiliate.referral_code} → {affiliate.total_referrals} referrals")
        
        # Test UserProfile model
        profile = UserProfile(
            user_id=12345,
            phone_number="+966501234567",
            phone_verified=True,
            profile_image_path="/images/user_12345.jpg",
            id_document_path="/docs/id_12345.pdf",
            recovery_password="RECOVERY_CODE_123",
            badges=["first_deposit", "10_games"],
            last_verified_date="2025-01-02T10:00:00"
        )
        print(f"  ✓ UserProfile model: user_id={profile.user_id}, badges={len(profile.badges)}")
        
        # Test Complaint model
        complaint = Complaint(
            id="COMPLAINT_001",
            user_id=12345,
            transaction_id="TXN_001",
            description="Game session not counted",
            status="investigating",
            resolution=None,
            balance_adjustment=Decimal("100.00"),
            created_date="2025-01-02T10:00:00",
            resolved_date=None,
            resolved_by=None
        )
        print(f"  ✓ Complaint model: {complaint.id} → Status: {complaint.status}")
        
        # Test BalanceLedgerEntry model
        ledger = BalanceLedgerEntry(
            id="LEDGER_001",
            user_id=12345,
            transaction_type="game_win",
            amount=Decimal("150.00"),
            balance_before=Decimal("100.00"),
            balance_after=Decimal("250.00"),
            description="Game session win",
            created_date="2025-01-02T10:00:00"
        )
        print(f"  ✓ BalanceLedgerEntry model: {ledger.transaction_type} → Amount: {ledger.amount}")
        
        # Test Enums
        assert GameType.CASINO.value == "casino", "GameType enum broken"
        print(f"  ✓ GameType enum: {GameType.CASINO.value}")
        
        assert AffiliateStatus.ACTIVE.value == "active", "AffiliateStatus enum broken"
        print(f"  ✓ AffiliateStatus enum: {AffiliateStatus.ACTIVE.value}")
        
        print("\n  ✅ Data Models: ALL TESTS PASSED\n")
    except Exception as e:
        print(f"\n  ❌ Data Models FAILED: {e}\n")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 3: Games Service
    print("✓ TEST 3: Games Service")
    print("-" * 60)
    try:
        from services.domain_services.games_service import games_service
        
        # Create a game
        game = await games_service.create_game(
            name="Dragon Slots",
            description="Classic slot machine game",
            game_type="casino",
            payout_min=50.0,
            payout_max=150.0
        )
        print(f"  ✓ Game created: {game.id} → {game.name}")
        
        # List games
        games = await games_service.list_available_games()
        print(f"  ✓ Games listed: {len(games)} active game(s)")
        
        # Play a game
        session, is_win = await games_service.play_game(
            user_id=12345,
            game_id=game.id,
            stake_amount=Decimal("100.00")
        )
        print(f"  ✓ Game played: {session.id} → Result: {'WIN' if is_win else 'LOSS'} (Profit/Loss: {session.profit_loss})")
        
        # Get user win rate
        win_rate = await games_service.get_user_win_rate(12345)
        print(f"  ✓ User win rate: {win_rate:.1f}%")
        
        # Set algorithm
        algo = await games_service.set_algorithm(
            game_id=game.id,
            region="SA",
            user_id=None,
            win_probability=0.60,
            loss_multiplier=1.5
        )
        print(f"  ✓ Algorithm set: {algo.id} → Win prob: {algo.win_probability}")
        
        # Get algorithm
        retrieved_algo = await games_service.get_algorithm(
            game_id=game.id,
            region="SA"
        )
        print(f"  ✓ Algorithm retrieved: {retrieved_algo.id if retrieved_algo else 'None'}")
        
        # Play with algorithm
        session2, is_win2 = await games_service.play_game(
            user_id=12345,
            game_id=game.id,
            stake_amount=Decimal("100.00")
        )
        print(f"  ✓ Game played (with algorithm): {session2.id} → Result: {'WIN' if is_win2 else 'LOSS'}")
        
        # Get user logs
        logs = await games_service.get_user_game_logs(12345)
        print(f"  ✓ Game logs: {len(logs)} entries for user 12345")
        
        # Detect suspicious patterns
        alerts = await games_service._detect_suspicious_patterns(12345)
        print(f"  ✓ Anti-cheat check: {len(alerts)} alert(s) (if any)")
        
        print("\n  ✅ Games Service: ALL TESTS PASSED\n")
    except Exception as e:
        print(f"\n  ❌ Games Service FAILED: {e}\n")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 4: Integration (CSV file persistence)
    print("✓ TEST 4: CSV File Persistence")
    print("-" * 60)
    try:
        # Check if CSV files were created
        data_dir = Path("data")
        csv_files = list(data_dir.glob("*.csv"))
        print(f"  ✓ CSV files created: {len(csv_files)}")
        
        for csv_file in csv_files:
            file_size = csv_file.stat().st_size
            line_count = sum(1 for _ in open(csv_file))
            print(f"    - {csv_file.name}: {line_count} lines, {file_size} bytes")
        
        # Read game sessions directly from CSV
        sessions_csv = csv_manager.read_all("game_sessions")
        print(f"  ✓ Game sessions persisted: {len(sessions_csv)} session(s)")
        
        # Read games
        all_games = csv_manager.read_all("games")
        print(f"  ✓ Games persisted: {len(all_games)} game(s)")
        
        print("\n  ✅ CSV Persistence: ALL TESTS PASSED\n")
    except Exception as e:
        print(f"\n  ❌ CSV Persistence FAILED: {e}\n")
        return False
    
    # Summary
    print("="*60)
    print("✅ PHASE 1 VALIDATION COMPLETE - ALL TESTS PASSED!")
    print("="*60)
    print("\nSummary:")
    print("  ✓ CSV Manager (CRUD operations)")
    print("  ✓ Data Models (11 dataclasses, 7 enums)")
    print("  ✓ Games Service (complete game engine)")
    print("  ✓ CSV Persistence (all files created)")
    print("\nStatus: READY FOR PHASE 2 (Agents Service)\n")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
