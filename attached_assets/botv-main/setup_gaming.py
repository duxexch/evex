#!/usr/bin/env python3
"""
Setup script for Gaming System
Creates demo games and test data
"""
import asyncio
from decimal import Decimal
from database import session_maker, init_db
from services.control_panel.gaming_service import GamingService
from models import GameType


async def setup_gaming_system():
    """Setup gaming system with demo data"""
    
    print("🎮 Setting up Gaming System...")
    
    # Initialize database
    print("📊 Initializing database tables...")
    await init_db()
    print("✅ Database initialized")
    
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        print("\n🎲 Creating demo games...")
        
        # Game 1: Roulette
        try:
            roulette = await gaming_service.create_game(
                name="روليت السعادة",
                description="ضع رهانك واختر رقمك المفضل! لعبة روليت مثيرة مع فرص ربح عالية.",
                game_type=GameType.INTERNAL,
                min_bet=Decimal("5.0"),
                max_bet=Decimal("500.0"),
                payout_min=Decimal("180.0"),
                payout_max=Decimal("250.0"),
                house_edge=Decimal("2.0"),
                admin_id=1,  # Change this to your admin ID
                icon_path="🎰"
            )
            print(f"✅ Created: {roulette.name} (ID: {roulette.id})")
        except Exception as e:
            print(f"⚠️  Roulette may already exist: {e}")
        
        # Game 2: Blackjack
        try:
            blackjack = await gaming_service.create_game(
                name="بلاك جاك",
                description="اقترب من 21 واربح! لعبة البطاقات الكلاسيكية.",
                game_type=GameType.INTERNAL,
                min_bet=Decimal("10.0"),
                max_bet=Decimal("1000.0"),
                payout_min=Decimal("150.0"),
                payout_max=Decimal("200.0"),
                house_edge=Decimal("1.5"),
                admin_id=1,
                icon_path="🃏"
            )
            print(f"✅ Created: {blackjack.name} (ID: {blackjack.id})")
        except Exception as e:
            print(f"⚠️  Blackjack may already exist: {e}")
        
        # Game 3: Slots
        try:
            slots = await gaming_service.create_game(
                name="ماكينة الحظ",
                description="اسحب واربح الجائزة الكبرى! ماكينة السلوتس الممتعة.",
                game_type=GameType.INTERNAL,
                min_bet=Decimal("1.0"),
                max_bet=Decimal("100.0"),
                payout_min=Decimal("100.0"),
                payout_max=Decimal("500.0"),
                house_edge=Decimal("3.0"),
                admin_id=1,
                icon_path="🎰"
            )
            print(f"✅ Created: {slots.name} (ID: {slots.id})")
        except Exception as e:
            print(f"⚠️  Slots may already exist: {e}")
        
        # Game 4: Dice
        try:
            dice = await gaming_service.create_game(
                name="زهر الحظ",
                description="ارمِ الزهر وتوقع النتيجة! لعبة بسيطة وممتعة.",
                game_type=GameType.INTERNAL,
                min_bet=Decimal("2.0"),
                max_bet=Decimal("200.0"),
                payout_min=Decimal("150.0"),
                payout_max=Decimal("300.0"),
                house_edge=Decimal("2.5"),
                admin_id=1,
                icon_path="🎲"
            )
            print(f"✅ Created: {dice.name} (ID: {dice.id})")
        except Exception as e:
            print(f"⚠️  Dice may already exist: {e}")
        
        # Game 5: Flying Plane (convert existing)
        try:
            plane = await gaming_service.create_game(
                name="الطائرة الطائرة",
                description="تابع الطائرة واسحب أرباحك قبل أن تطير! لعبة مثيرة ومشوقة.",
                game_type=GameType.INTERNAL,
                min_bet=Decimal("5.0"),
                max_bet=Decimal("500.0"),
                payout_min=Decimal("120.0"),
                payout_max=Decimal("1000.0"),
                house_edge=Decimal("2.0"),
                admin_id=1,
                icon_path="✈️"
            )
            print(f"✅ Created: {plane.name} (ID: {plane.id})")
        except Exception as e:
            print(f"⚠️  Flying Plane may already exist: {e}")
        
        print("\n✅ Gaming System setup complete!")
        print("\n📝 Next steps:")
        print("1. Start the bot: python bot_main.py")
        print("2. Test in Telegram: /games")
        print("3. Create tickets: /ticket or /deposit or /withdraw")
        print("4. Add test balance (see GAMING_QUICK_START.md)")


if __name__ == "__main__":
    asyncio.run(setup_gaming_system())
