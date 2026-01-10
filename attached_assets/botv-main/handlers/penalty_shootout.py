"""
Penalty Shootout Telegram Handler
User-facing game interface with dynamic betting and real-time balance updates
"""

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from decimal import Decimal
from typing import Optional
import logging

from models.penalty_shootout import (
    PenaltyShotDirection, PenaltyShotOutcome
)
from services.games.penalty_shootout_service import PenaltyShootoutService
from database import session_maker

logger = logging.getLogger(__name__)
router = Router(name="penalty_shootout")


class PenaltyStates(StatesGroup):
    """FSM states for Penalty Shootout game"""
    selecting_game = State()
    entering_rounds = State()
    betting = State()  # Before each shot
    shooting = State()  # During shot
    result = State()  # After shot


# ============================================================================
# GAME LOBBY
# ============================================================================

@router.message(Command("penalty"))
async def cmd_penalty(message: Message, state: FSMContext):
    """
    Start Penalty Shootout game
    Show available games
    """
    user_id = message.from_user.id
    
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        
        # Get active games
        games = await service.get_active_games()
        
        if not games:
            await message.answer("⚽ لا توجد ألعاب ضربات جزاء متاحة حالياً")
            return
        
        # Build message
        text = "⚽ <b>ضربات الجزاء</b>\n\n"
        text += "اختر اللعبة:\n\n"
        
        keyboard = []
        for game in games:
            icon = game.icon_path or "⚽"
            keyboard.append([
                InlineKeyboardButton(
                    text=f"{icon} {game.name}",
                    callback_data=f"penalty_game:{game.id}"
                )
            ])
        
        await message.answer(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
        
        await state.set_state(PenaltyStates.selecting_game)


@router.callback_query(F.data.startswith("penalty_game:"))
async def game_selected(callback: CallbackQuery, state: FSMContext):
    """
    Game selected
    Ask for number of rounds (1-5)
    """
    game_id = int(callback.data.split(":")[1])
    
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        game = await service.get_game(game_id)
        
        if not game:
            await callback.answer("❌ اللعبة غير متاحة", show_alert=True)
            return
        
        await state.update_data(game_id=game_id)
        
        # Show game info and ask for rounds
        icon = game.icon_path or "⚽"
        text = f"{icon} <b>{game.name}</b>\n\n"
        text += f"📝 {game.description}\n\n"
        text += f"🎯 <b>الحد الأدنى للرهان:</b> {game.min_bet_amount}\n"
        text += f"🎯 <b>الحد الأقصى للرهان:</b> {game.max_bet_amount}\n"
        text += f"🔄 <b>عدد الجولات:</b> {game.min_rounds} - {game.max_rounds}\n\n"
        text += f"🏆 <b>مكافأة الهدف:</b> {game.goal_multiplier}x\n"
        text += f"🧤 <b>احتمال إنقاذ الحارس:</b> {game.keeper_save_probability}%\n\n"
        text += "اختر عدد الجولات:"
        
        keyboard = []
        for i in range(game.min_rounds, game.max_rounds + 1):
            keyboard.append([
                InlineKeyboardButton(
                    text=f"{i} جولات",
                    callback_data=f"penalty_rounds:{game_id}:{i}"
                )
            ])
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
    
    await callback.answer()


@router.callback_query(F.data.startswith("penalty_rounds:"))
async def rounds_selected(callback: CallbackQuery, state: FSMContext):
    """
    Rounds selected
    Create session and start betting
    """
    parts = callback.data.split(":")
    game_id = int(parts[1])
    num_rounds = int(parts[2])
    user_id = callback.from_user.id
    
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        
        try:
            # Create session
            game_session = await service.create_session(
                player_id=user_id,
                game_id=game_id,
                num_rounds=num_rounds
            )
            
            await state.update_data(
                session_id=game_session.session_id,
                game_id=game_id,
                num_rounds=num_rounds
            )
            
            # Show first betting screen
            await show_betting_screen(callback.message, state, service, game_id)
            
        except ValueError as e:
            await callback.answer(f"❌ {str(e)}", show_alert=True)
    
    await callback.answer()


# ============================================================================
# BETTING SCREEN (APPEARS BEFORE EACH SHOT)
# ============================================================================

async def show_betting_screen(message: Message, state: FSMContext, service, game_id: int):
    """
    Show betting screen
    - Current balance
    - Bet amount input field
    - Quick bet buttons
    """
    from models import User
    from sqlalchemy import select
    
    data = await state.get_data()
    session_id = data.get('session_id')
    
    # Get game and player
    game = await service.get_game(game_id)
    
    async with session_maker() as session:
        result = await session.execute(
            select(User).where(User.id == message.from_user.id)
        )
        player = result.scalar_one()
    
    # Get round number
    game_session = await service.get_session(session_id)
    round_num = game_session.rounds_completed + 1
    
    # Build message
    icon = game.icon_path or "⚽"
    text = f"{icon} <b>جولة {round_num}/{game_session.num_rounds}</b>\n\n"
    text += f"💰 <b>رصيدك الحالي:</b> <code>{player.balance}</code>\n\n"
    text += f"💵 <b>الحد الأدنى للرهان:</b> {game.min_bet_amount}\n"
    text += f"💵 <b>الحد الأقصى للرهان:</b> {game.max_bet_amount}\n\n"
    text += "<b>💬 أدخل مبلغ الرهان أو اختر من الأزرار أدناه:</b>"
    
    # Quick bet buttons
    quick_amounts = [
        Decimal("10.0"),
        Decimal("50.0"),
        Decimal("100.0"),
        game.max_bet_amount
    ]
    
    keyboard = []
    for amount in quick_amounts:
        if amount <= player.balance and amount <= game.max_bet_amount:
            keyboard.append([
                InlineKeyboardButton(
                    text=f"💰 {amount}",
                    callback_data=f"penalty_bet:{session_id}:{amount}"
                )
            ])
    
    keyboard.append([
        InlineKeyboardButton(text="❌ إلغاء اللعبة", callback_data="penalty_cancel")
    ])
    
    await message.answer(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
        parse_mode="HTML"
    )
    
    await state.set_state(PenaltyStates.betting)


@router.callback_query(F.data.startswith("penalty_bet:"))
async def quick_bet(callback: CallbackQuery, state: FSMContext):
    """Quick bet button"""
    parts = callback.data.split(":")
    session_id = parts[1]
    bet_amount = Decimal(parts[2])
    
    await execute_shot(callback, state, session_id, bet_amount)


@router.message(PenaltyStates.betting)
async def custom_bet_amount(message: Message, state: FSMContext):
    """
    User enters custom bet amount
    """
    try:
        bet_amount = Decimal(message.text.strip())
        
        if bet_amount <= 0:
            await message.answer("❌ المبلغ يجب أن يكون أكبر من صفر")
            return
        
        data = await state.get_data()
        session_id = data.get("session_id")
        
        # Create callback-like object
        class FakeCallback:
            def __init__(self, msg):
                self.message = msg
                self.from_user = msg.from_user
            
            async def answer(self, text="", show_alert=False):
                if show_alert:
                    await self.message.answer(text)
        
        fake_cb = FakeCallback(message)
        await execute_shot(fake_cb, state, session_id, bet_amount)
        
    except (ValueError, ArithmeticError):
        await message.answer("❌ مبلغ غير صالح. أدخل رقماً صحيحاً")


# ============================================================================
# SHOOTING SCREEN (DIRECTION SELECTION)
# ============================================================================

async def execute_shot(callback, state: FSMContext, session_id: str, bet_amount: Decimal):
    """
    Show shooting interface
    Player chooses direction (left, center, right)
    """
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        game_session = await service.get_session(session_id)
        
        if not game_session:
            await callback.answer("❌ الجلسة غير موجودة", show_alert=True)
            return
        
        # Validate bet
        try:
            game = game_session.game
            if bet_amount < game.min_bet_amount:
                await callback.answer(
                    f"❌ المبلغ أقل من الحد الأدنى {game.min_bet_amount}",
                    show_alert=True
                )
                return
            
            if bet_amount > game.max_bet_amount:
                await callback.answer(
                    f"❌ المبلغ أكثر من الحد الأقصى {game.max_bet_amount}",
                    show_alert=True
                )
                return
        except Exception as e:
            logger.error(f"Error validating bet: {e}")
            await callback.answer("❌ خطأ في التحقق من المبلغ", show_alert=True)
            return
        
        # Store bet amount for next step
        await state.update_data(bet_amount=str(bet_amount))
        
        # Show direction selection
        round_num = game_session.rounds_completed + 1
        text = f"⚽ <b>جولة {round_num}/{game_session.num_rounds}</b>\n\n"
        text += f"💰 <b>رهانك:</b> <code>{bet_amount}</code>\n\n"
        text += "<b>🎯 اختر اتجاه التسديد:</b>\n\n"
        text += "👈 <b>يسار</b>  |  👍 <b>وسط</b>  |  👉 <b>يمين</b>"
        
        keyboard = [
            [
                InlineKeyboardButton(text="👈 يسار", callback_data=f"penalty_shoot:{session_id}:left"),
                InlineKeyboardButton(text="👍 وسط", callback_data=f"penalty_shoot:{session_id}:center"),
                InlineKeyboardButton(text="👉 يمين", callback_data=f"penalty_shoot:{session_id}:right")
            ]
        ]
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
        
        await state.set_state(PenaltyStates.shooting)


@router.callback_query(F.data.startswith("penalty_shoot:"))
async def player_shoots(callback: CallbackQuery, state: FSMContext):
    """
    Player shoots
    Execute the shot and show result
    """
    parts = callback.data.split(":")
    session_id = parts[1]
    direction_str = parts[2]
    
    data = await state.get_data()
    bet_amount = Decimal(data.get("bet_amount", "0"))
    
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        
        try:
            # Execute shot
            direction = PenaltyShotDirection[direction_str.upper()]
            round_record, result = await service.take_shot(
                session_id=session_id,
                bet_amount=bet_amount,
                shot_direction=direction
            )
            
            # Show result
            await show_result(callback.message, state, result, service, session_id)
            
        except ValueError as e:
            await callback.answer(f"❌ {str(e)}", show_alert=True)
        except Exception as e:
            logger.error(f"Error in penalty_shoot: {e}", exc_info=True)
            await callback.answer("❌ خطأ في تنفيذ التسديدة", show_alert=True)
    
    await callback.answer()


# ============================================================================
# RESULT SCREEN
# ============================================================================

async def show_result(message: Message, state: FSMContext, result: dict, service, session_id: str):
    """
    Show shot result
    - Keeper animation
    - Outcome (Goal/Saved/Miss)
    - Balance update
    - Option to play next round or return to lobby
    """
    
    outcome = result['outcome']
    keeper_reaction = result['keeper_reaction']
    bet_amount = result['bet_amount']
    win_amount = result['win_amount']
    new_balance = result['new_balance']
    round_num = result['round']
    total_rounds = result['total_rounds']
    is_completed = result['is_session_completed']
    
    # Build result message
    if outcome == PenaltyShotOutcome.GOAL.value:
        emoji = "🎉"
        outcome_text = "GOAL! هدف!"
        outcome_color = "Green"
    elif outcome == PenaltyShotOutcome.SAVED.value:
        emoji = "🧤"
        outcome_text = "Saved! أنقذ الحارس!"
        outcome_color = "Red"
    else:  # MISS
        emoji = "❌"
        outcome_text = "Miss! أخطأ!"
        outcome_color = "Red"
    
    text = f"{emoji} <b>{outcome_text}</b>\n\n"
    text += f"👨‍🦰 <b>رد الحارس:</b> {keeper_reaction}\n\n"
    text += f"💰 <b>رهان:</b> {bet_amount}\n"
    text += f"💵 <b>مكسب:</b> {win_amount}\n\n"
    text += f"💳 <b>رصيدك الجديد:</b> <code>{new_balance}</code>\n\n"
    text += f"📊 <b>الجولة:</b> {round_num}/{total_rounds}\n"
    
    if is_completed:
        profit_loss = result['session_profit_loss']
        text += f"\n✅ <b>اللعبة مكتملة!</b>\n"
        text += f"📈 <b>الربح/الخسارة النهائي:</b> {profit_loss}"
        
        keyboard = [
            [InlineKeyboardButton(text="⚽ لعب مرة أخرى", callback_data="cmd_penalty")],
            [InlineKeyboardButton(text="🔙 الرجوع للقائمة الرئيسية", callback_data="main_menu")]
        ]
    else:
        # Next round
        keyboard = [
            [InlineKeyboardButton(text="⚽ الجولة التالية", callback_data=f"penalty_next:{session_id}")]
        ]
    
    await message.edit_text(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
        parse_mode="HTML"
    )
    
    await state.set_state(PenaltyStates.result)


@router.callback_query(F.data.startswith("penalty_next:"))
async def next_round(callback: CallbackQuery, state: FSMContext):
    """
    Go to next round
    Show betting screen again
    """
    session_id = callback.data.split(":")[1]
    
    async with session_maker() as session:
        service = PenaltyShootoutService(session)
        
        data = await state.get_data()
        game_id = data.get("game_id")
        
        # Back to betting
        await show_betting_screen(callback.message, state, service, game_id)
    
    await callback.answer()


@router.callback_query(F.data == "penalty_cancel")
async def cancel_game(callback: CallbackQuery, state: FSMContext):
    """Cancel the game"""
    # TODO: Implement game cancellation (refund bet if in progress)
    
    await callback.message.edit_text("❌ تم إلغاء اللعبة")
    await state.clear()
    await callback.answer()
