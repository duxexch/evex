#!/usr/bin/env python3
"""
Pre-game Setup: Create Flying Plane game record
Run this before testing
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

async def create_flying_plane_game():
    """Create Flying Plane game in GamesService"""
    
    print("\n" + "="*70)
    print("🎮 CREATING FLYING PLANE GAME RECORD")
    print("="*70 + "\n")
    
    try:
        from services.domain_services.games_service import games_service
        from services.domain_services.csv_manager import csv_manager
        
        # Check if game already exists
        existing = csv_manager.read_by_id("games", "FLYING_PLANE")
        
        if existing:
            print("✅ Flying Plane game already exists in games.csv")
            return True
        
        print("📝 Creating Flying Plane game...")
        
        # Create the game using GamesService
        game = await games_service.create_game(
            name="Flying Plane",
            description="Guide your plane through obstacles. Avoid collision and maximize your score!",
            game_type="arcade",
            payout_min=100.0,
            payout_max=150.0
        )
        
        print(f"✅ Game created successfully!")
        print(f"   ID: {game.id}")
        print(f"   Name: {game.name}")
        print(f"   Type: {game.type}")
        print(f"   Payout: {game.payout_min_percent}% - {game.payout_max_percent}%")
        print(f"   Status: {game.status}\n")
        
        # Verify in CSV
        stored = csv_manager.read_by_id("games", "FLYING_PLANE")
        if stored:
            print("✅ Game verified in games.csv")
        
        return True
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(create_flying_plane_game())
    sys.exit(0 if success else 1)
