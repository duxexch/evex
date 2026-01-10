"""
Telegram Bot Handlers for Gaming System
User-facing game interface with balance display and betting
"""
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from decimal import Decimal
from typing import Optional
import logging

from models import GameType, GameOutcome, GameStatus
from services.control_panel.gaming_service import GamingService
from database import session_maker

logger = logging.getLogger(__name__)
router = Router(name="games")


class GameStates(StatesGroup):
    """FSM states for game flow."""
    selecting_game = State()
    entering_bet = State()
    playing = State()


# ============================================================================
# GAME LOBBY
# ============================================================================

@router.message(Command("games"))
async def cmd_games(message: Message, state: FSMContext):
    """
    Show game lobby with available games.
    Display: icon, name, min/max bet, type (internal/external)
    """
    user_id = message.from_user.id
    
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        # Get active games
        games = await gaming_service.get_active_games()
        
        if not games:
            await message.answer("🎮 لا توجد ألعاب متاحة حالياً")
            return
        
        # Build game list message
        text = "🎮 <b>قائمة الألعاب المتاحة</b>\n\n"
        
        for game in games:
            icon = game.icon_path or "🎲"
            game_type_text = "داخلية" if game.game_type == GameType.INTERNAL else "خارجية"
            
            text += f"{icon} <b>{game.name}</b>\n"
            text += f"📝 {game.description}\n"
            text += f"💰 الحد الأدنى: {game.min_bet_amount} | الحد الأقصى: {game.max_bet_amount}\n"
            text += f"🔢 النوع: {game_type_text}\n"
            
            if game.is_featured:
                text += "⭐ <i>مميزة</i>\n"
            
            text += "\n"
        
        # Build inline keyboard
        keyboard = []
        for game in games:
            icon = game.icon_path or "🎲"
            keyboard.append([
                InlineKeyboardButton(
                    text=f"{icon} {game.name}",
                    callback_data=f"game_select:{game.id}"
                )
            ])
        
        keyboard.append([
            InlineKeyboardButton(text="🔄 تحديث", callback_data="games_refresh")
        ])
        
        await message.answer(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
        
        await state.set_state(GameStates.selecting_game)


@router.callback_query(F.data == "games_refresh")
async def refresh_games(callback: CallbackQuery):
    """Refresh game list."""
    await callback.message.delete()
    await cmd_games(callback.message, FSMContext(storage=callback.message.bot.fsm_context.storage, key=callback.message.chat.id))
    await callback.answer()


# ============================================================================
# GAME DETAILS & BET ENTRY
# ============================================================================

@router.callback_query(F.data.startswith("game_select:"))
async def game_selected(callback: CallbackQuery, state: FSMContext):
    """
    Show game details and ask for bet amount.
    Display: current balance, min/max bet, game rules
    """
    game_id = int(callback.data.split(":")[1])
    user_id = callback.from_user.id
    
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        # Get game details
        game = await gaming_service.get_game_by_id(game_id)
        if not game or game.status != GameStatus.ACTIVE:
            await callback.answer("❌ اللعبة غير متاحة", show_alert=True)
            return
        
        # Get user balance
        from sqlalchemy import select
        from models import User
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            await callback.answer("❌ خطأ في الحصول على بيانات المستخدم", show_alert=True)
            return
        
        # Store game ID in state
        await state.update_data(game_id=game_id)
        
        # Build game details message
        icon = game.icon_path or "🎲"
        game_type_text = "داخلية" if game.game_type == GameType.INTERNAL else "خارجية"
        
        text = f"{icon} <b>{game.name}</b>\n\n"
        text += f"📝 {game.description}\n\n"
        text += f"💰 <b>رصيدك الحالي:</b> {user.balance}\n\n"
        text += f"🎯 <b>الحد الأدنى للرهان:</b> {game.min_bet_amount}\n"
        text += f"🎯 <b>الحد الأقصى للرهان:</b> {game.max_bet_amount}\n\n"
        text += f"📊 <b>نسبة العائد:</b> {game.payout_min_percent}% - {game.payout_max_percent}%\n"
        text += f"🏠 <b>نسبة المنصة:</b> {game.house_edge_percent}%\n\n"
        text += f"🔢 <b>النوع:</b> {game_type_text}\n\n"
        text += "💵 <b>أدخل مبلغ الرهان:</b>"
        
        # Quick bet buttons
        keyboard = []
        
        # Quick amounts
        quick_amounts = [
            game.min_bet_amount,
            game.min_bet_amount * 5,
            game.min_bet_amount * 10,
            game.max_bet_amount
        ]
        
        quick_amounts = list(set(quick_amounts))  # Remove duplicates
        quick_amounts.sort()
        
        for amount in quick_amounts:
            if amount <= user.balance and amount <= game.max_bet_amount:
                keyboard.append([
                    InlineKeyboardButton(
                        text=f"💰 {amount}",
                        callback_data=f"bet_quick:{game_id}:{amount}"
                    )
                ])
        
        keyboard.append([
            InlineKeyboardButton(text="✏️ إدخال مبلغ مخصص", callback_data=f"bet_custom:{game_id}")
        ])
        keyboard.append([
            InlineKeyboardButton(text="🔙 رجوع", callback_data="games_back")
        ])
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
        
        await state.set_state(GameStates.entering_bet)
    
    await callback.answer()


@router.callback_query(F.data.startswith("bet_quick:"))
async def quick_bet(callback: CallbackQuery, state: FSMContext):
    """Handle quick bet button."""
    parts = callback.data.split(":")
    game_id = int(parts[1])
    bet_amount = Decimal(parts[2])
    
    await start_game(callback, state, game_id, bet_amount)


@router.callback_query(F.data.startswith("bet_custom:"))
async def custom_bet(callback: CallbackQuery, state: FSMContext):
    """Ask user to enter custom bet amount."""
    game_id = int(callback.data.split(":")[1])
    
    await state.update_data(game_id=game_id)
    
    await callback.message.edit_text(
        "💵 <b>أدخل مبلغ الرهان:</b>\n\n"
        "أرسل المبلغ الذي تريد المراهنة به",
        parse_mode="HTML"
    )
    
    await state.set_state(GameStates.entering_bet)
    await callback.answer()


@router.message(GameStates.entering_bet)
async def process_custom_bet(message: Message, state: FSMContext):
    """Process custom bet amount entered by user."""
    try:
        bet_amount = Decimal(message.text)
        
        if bet_amount <= 0:
            await message.answer("❌ المبلغ يجب أن يكون أكبر من صفر")
            return
        
        data = await state.get_data()
        game_id = data.get("game_id")
        
        if not game_id:
            await message.answer("❌ خطأ في الحصول على بيانات اللعبة")
            return
        
        # Create callback query object for start_game
        from aiogram.types import User as TgUser
        callback = type('obj', (object,), {
            'from_user': message.from_user,
            'message': message,
            'answer': lambda text="", show_alert=False: message.answer(text)
        })()
        
        await start_game(callback, state, game_id, bet_amount)
        
    except (ValueError, ArithmeticError):
        await message.answer("❌ مبلغ غير صالح. أدخل رقماً صحيحاً")


# ============================================================================
# START GAME SESSION
# ============================================================================

async def start_game(callback, state: FSMContext, game_id: int, bet_amount: Decimal):
    """
    Start game session:
    1. Validate bet amount
    2. Deduct from balance
    3. Create session with signature
    4. Launch game
    """
    user_id = callback.from_user.id
    
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        try:
            # Start game session (this validates and deducts balance)
            game_session = await gaming_service.start_game_session(
                player_id=user_id,
                game_id=game_id,
                bet_amount=bet_amount,
                ip_address=None,  # Can be extracted from webhook
                user_agent=None
            )
            
            # Store session in state
            await state.update_data(
                session_id=game_session.session_id,
                game_id=game_id,
                bet_amount=str(bet_amount)
            )
            
            # Get updated balance
            from sqlalchemy import select
            from models import User
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one()
            
            # Build game launch message
            text = f"🎮 <b>جلسة اللعب بدأت!</b>\n\n"
            text += f"🎲 <b>اللعبة:</b> {game_session.game.name}\n"
            text += f"💰 <b>مبلغ الرهان:</b> {bet_amount}\n"
            text += f"💵 <b>رصيدك بعد الرهان:</b> {user.balance}\n\n"
            text += f"🔑 <b>معرف الجلسة:</b> <code>{game_session.session_id[:16]}...</code>\n\n"
            
            if game_session.game.game_type == GameType.INTERNAL:
                text += "🎯 اختر نتيجتك:"
                
                keyboard = [
                    [
                        InlineKeyboardButton(text="✅ فوز", callback_data=f"game_result:win:{game_session.session_id}"),
                        InlineKeyboardButton(text="❌ خسارة", callback_data=f"game_result:lose:{game_session.session_id}")
                    ],
                    [
                        InlineKeyboardButton(text="🚫 إلغاء", callback_data=f"game_result:cancel:{game_session.session_id}")
                    ]
                ]
                
                await callback.message.edit_text(
                    text,
                    reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                    parse_mode="HTML"
                )
            
            else:  # EXTERNAL game
                text += f"🌐 <b>انقر لبدء اللعبة الخارجية:</b>\n"
                text += f"🔗 <a href='{game_session.game.game_launch_url}?token={game_session.session_token}'>افتح اللعبة</a>\n\n"
                text += "⏱️ الجلسة صالحة لمدة 60 دقيقة"
                
                keyboard = [
                    [InlineKeyboardButton(text="🔙 رجوع للألعاب", callback_data="games_back")]
                ]
                
                await callback.message.edit_text(
                    text,
                    reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                    parse_mode="HTML"
                )
            
            await state.set_state(GameStates.playing)
            await callback.answer("✅ جلسة اللعب بدأت!")
            
        except ValueError as e:
            await callback.answer(f"❌ {str(e)}", show_alert=True)
        except Exception as e:
            logger.error(f"Error starting game session: {e}", exc_info=True)
            await callback.answer("❌ خطأ في بدء اللعبة", show_alert=True)


# ============================================================================
# END GAME SESSION (INTERNAL GAMES)
# ============================================================================

@router.callback_query(F.data.startswith("game_result:"))
async def game_result(callback: CallbackQuery, state: FSMContext):
    """
    Handle game result for internal games.
    Calculate win amount and update balance.
    """
    parts = callback.data.split(":")
    result_type = parts[1]  # win, lose, cancel
    session_id = parts[2]
    
    user_id = callback.from_user.id
    
    async with session_maker() as session:
        gaming_service = GamingService(session)
        
        try:
            # Get session data
            data = await state.get_data()
            bet_amount = Decimal(data.get("bet_amount", "0"))
            
            # Determine outcome and win amount
            if result_type == "win":
                outcome = GameOutcome.WIN
                # Simple 2x payout for demo (should use game's payout config)
                win_amount = bet_amount * Decimal("2.0")
            elif result_type == "lose":
                outcome = GameOutcome.LOSE
                win_amount = Decimal("0")
            else:  # cancel
                outcome = GameOutcome.CANCELLED
                win_amount = bet_amount  # Return bet amount
            
            # End session
            game_session = await gaming_service.end_game_session(
                session_id=session_id,
                outcome=outcome,
                win_amount=win_amount,
                game_data={"result_type": result_type}
            )
            
            # Get updated balance
            from sqlalchemy import select
            from models import User
            result_db = await session.execute(select(User).where(User.id == user_id))
            user = result_db.scalar_one()
            
            # Build result message
            if outcome == GameOutcome.WIN:
                emoji = "🎉"
                result_text = "فوز!"
            elif outcome == GameOutcome.LOSE:
                emoji = "😢"
                result_text = "خسارة"
            else:
                emoji = "🚫"
                result_text = "ملغاة"
            
            text = f"{emoji} <b>نتيجة اللعبة: {result_text}</b>\n\n"
            text += f"💰 <b>مبلغ الرهان:</b> {bet_amount}\n"
            text += f"🏆 <b>المكسب:</b> {win_amount}\n"
            text += f"📊 <b>الربح/الخسارة:</b> {game_session.profit_loss}\n\n"
            text += f"💵 <b>رصيدك الجديد:</b> {user.balance}\n\n"
            
            keyboard = [
                [InlineKeyboardButton(text="🔄 لعب مرة أخرى", callback_data=f"game_select:{data.get('game_id')}")],
                [InlineKeyboardButton(text="🔙 رجوع للألعاب", callback_data="games_back")]
            ]
            
            await callback.message.edit_text(
                text,
                reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                parse_mode="HTML"
            )
            
            await state.clear()
            await callback.answer(f"{emoji} {result_text}")
            
        except ValueError as e:
            await callback.answer(f"❌ {str(e)}", show_alert=True)
        except Exception as e:
            logger.error(f"Error ending game session: {e}", exc_info=True)
            await callback.answer("❌ خطأ في إنهاء اللعبة", show_alert=True)


# ============================================================================
# NAVIGATION
# ============================================================================

@router.callback_query(F.data == "games_back")
async def games_back(callback: CallbackQuery, state: FSMContext):
    """Go back to game lobby."""
    await callback.message.delete()
    await cmd_games(callback.message, state)
    await callback.answer()


# ============================================================================
# GAME HISTORY
# ============================================================================

@router.message(Command("game_history"))
async def cmd_game_history(message: Message):
    """Show player's game history."""
    user_id = message.from_user.id
    
    async with session_maker() as session:
        from sqlalchemy import select
        from models import SecureGameSession
        
        # Get recent sessions
        result = await session.execute(
            select(SecureGameSession)
            .where(SecureGameSession.player_id == user_id)
            .order_by(SecureGameSession.start_time.desc())
            .limit(10)
        )
        sessions = list(result.scalars().all())
        
        if not sessions:
            await message.answer("📊 لا توجد ألعاب سابقة")
            return
        
        text = "📊 <b>سجل ألعابك الأخيرة</b>\n\n"
        
        for s in sessions:
            outcome_emoji = {
                GameOutcome.WIN: "🎉",
                GameOutcome.LOSE: "😢",
                GameOutcome.CANCELLED: "🚫",
                GameOutcome.PENDING: "⏳"
            }.get(s.outcome, "❓")
            
            text += f"{outcome_emoji} <b>{s.game.name}</b>\n"
            text += f"💰 رهان: {s.bet_amount} | ربح: {s.win_amount or 0}\n"
            text += f"📊 P/L: {s.profit_loss or 0}\n"
            text += f"🕐 {s.start_time.strftime('%Y-%m-%d %H:%M')}\n\n"
        
        await message.answer(text, parse_mode="HTML")
