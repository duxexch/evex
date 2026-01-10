#!/usr/bin/env python3
"""
Admin handlers for game algorithm settings
Allows admins to view/change algorithm mode and configuration via Telegram
"""

from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.filters import Command
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models import GameSession, GameRound, AuditLog
from services.system_settings_service import (
    SystemSettingsService,
    SettingKey,
    get_game_algorithm_mode,
    get_house_edge_percentage,
    is_game_algorithms_enabled
)
from services.audit_log_service import AuditLogService
from utils.auth import admin_required
from services.i18n import get_text

router = Router()


@router.message(Command('algorithm_settings'))
@admin_required
async def algorithm_settings_menu(message: Message, session_maker):
    """Show game algorithm settings menu"""
    
    async with session_maker() as session:
        # Get current settings
        current_algo = await get_game_algorithm_mode(session)
        house_edge = await get_house_edge_percentage(session)
        is_enabled = await is_game_algorithms_enabled(session)
        
        # Get active game sessions count
        query = select(func.count(GameSession.id)).where(GameSession.status == 'ACTIVE')
        result = await session.execute(query)
        active_sessions = result.scalar() or 0
        
        text = f"""⚙️ *{get_text('algorithm_settings', message.from_user.language_code or 'ar')}*

*Current Configuration:*
🎮 *Algorithm Mode:* `{current_algo}`
📊 *House Edge:* `{house_edge}%`
🔌 *Feature Enabled:* {'✅ Yes' if is_enabled else '❌ No'}
🎲 *Active Sessions:* `{active_sessions}`

*Available Algorithms:*
• 💎 `FIXED_HOUSE_EDGE` - Transparent, conservative (Default)
• 🧠 `DYNAMIC` - Adaptive behavior (Beta)

*What would you like to do?*"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="📊 View Settings", callback_data="algo_view_settings"),
                InlineKeyboardButton(text="🔄 Change Algorithm", callback_data="algo_change_mode")
            ],
            [
                InlineKeyboardButton(text="📈 Adjust House Edge", callback_data="algo_adjust_edge"),
                InlineKeyboardButton(text="📋 View History", callback_data="algo_view_history")
            ],
            [
                InlineKeyboardButton(text="📊 Algorithm Stats", callback_data="algo_view_stats"),
                InlineKeyboardButton(text="⚠️ Emergency Reset", callback_data="algo_emergency_reset")
            ]
        ])
        
        await message.answer(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "algo_view_settings")
@admin_required
async def view_algorithm_settings(query: CallbackQuery, session_maker):
    """View current algorithm settings in detail"""
    
    async with session_maker() as session:
        current_algo = await get_game_algorithm_mode(session)
        house_edge = await get_house_edge_percentage(session)
        max_payout = await SystemSettingsService.get_setting(session, SettingKey.MAX_PAYOUT_MULTIPLIER, default=36.0)
        rtp = await SystemSettingsService.get_setting(session, SettingKey.RTP_TARGET, default=95.0)
        
        algo_descriptions = {
            'FIXED_HOUSE_EDGE': '💎 Fixed, transparent house advantage\nDeterministic outcomes\nMathematically verifiable fairness\n\n✓ Default mode\n✓ Most conservative\n✓ Full transparency',
            'DYNAMIC': '🧠 Adaptive algorithm\nBased on player behavior and risk factors\nIsolated, sandboxed implementation\n\n⚠️ Experimental mode\n⚠️ Only affects NEW sessions',
        }
        
        text = f"""*Algorithm Configuration*

🎮 *Active Algorithm:* `{current_algo}`

*Details:*
{algo_descriptions.get(current_algo, 'Unknown algorithm')}

*Current Parameters:*
📊 House Edge: `{house_edge}%`
💰 Max Payout: `{max_payout}x`
🎯 RTP Target: `{rtp}%`

*Safety Notes:*
✓ Only affects NEW game sessions
✓ Active sessions unchanged
✓ All outcomes logged immutably
✓ Fully auditable"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="algo_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "algo_change_mode")
@admin_required
async def change_algorithm_mode(query: CallbackQuery, session_maker):
    """Show algorithm change options"""
    
    async with session_maker() as session:
        current_algo = await get_game_algorithm_mode(session)
        
        text = f"""*Switch Algorithm Mode*

*Current:* `{current_algo}`

⚠️ *Important:*
✓ Only affects NEW game sessions
✓ Active sessions continue unaffected
✓ All changes logged to audit trail

*Select new algorithm:*"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text="💎 FIXED_HOUSE_EDGE (Conservative)",
                callback_data="algo_switch_fixed"
            )],
            [InlineKeyboardButton(
                text="🧠 DYNAMIC (Experimental)",
                callback_data="algo_switch_dynamic"
            )],
            [InlineKeyboardButton(
                text="❌ Cancel",
                callback_data="algo_cancel_change"
            )]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data.startswith("algo_switch_"))
@admin_required
async def execute_algorithm_switch(query: CallbackQuery, session_maker):
    """Execute algorithm switch"""
    
    mode_map = {
        'algo_switch_fixed': 'FIXED_HOUSE_EDGE',
        'algo_switch_dynamic': 'DYNAMIC',
    }
    
    new_algo = mode_map.get(query.data, 'FIXED_HOUSE_EDGE')
    
    async with session_maker() as session:
        old_algo = await get_game_algorithm_mode(session)
        old_config = {
            'house_edge': float(await get_house_edge_percentage(session)),
            'max_payout': float(await SystemSettingsService.get_setting(session, SettingKey.MAX_PAYOUT_MULTIPLIER, default=36.0)),
        }
        
        if old_algo == new_algo:
            await query.answer(f"Already using {new_algo}", show_alert=True)
            return
        
        try:
            # Update setting
            await SystemSettingsService.set_setting(
                session,
                key=SettingKey.GAME_ALGORITHM_MODE,
                value=new_algo,
                category='game_algorithms',
                admin_id=query.from_user.id,
            )
            
            # Log change
            new_config = old_config.copy()
            await AuditLogService.log_algorithm_config_change(
                session,
                admin_id=query.from_user.id,
                old_algorithm=old_algo,
                new_algorithm=new_algo,
                old_config=old_config,
                new_config=new_config,
                change_reason="Admin initiated via Telegram",
                ip_address=None,
            )
            
            await session.commit()
            
            text = f"""✅ *Algorithm Switched Successfully*

🎮 *Old Algorithm:* `{old_algo}`
🎮 *New Algorithm:* `{new_algo}`
⏰ *Time:* `{query.message.date.strftime('%Y-%m-%d %H:%M:%S')}`

*Effect:*
✓ Affects NEW game sessions immediately
✓ Active sessions unaffected
✓ All outcomes remain immutable
✓ Change logged to audit trail

*Safety:*
All game outcomes using `{new_algo}` will be fully auditable."""
            
            await query.message.edit_text(text, parse_mode='Markdown')
            await query.answer(f"Algorithm switched to {new_algo}", show_alert=True)
            
        except Exception as e:
            error_text = f"❌ *Error switching algorithm*\n\n`{str(e)}`"
            await query.message.edit_text(error_text, parse_mode='Markdown')
            await query.answer("Error occurred", show_alert=True)


@router.callback_query(F.data == "algo_adjust_edge")
@admin_required
async def adjust_house_edge(query: CallbackQuery, session_maker):
    """Show house edge adjustment options"""
    
    async with session_maker() as session:
        current_edge = await get_house_edge_percentage(session)
        
        text = f"""*Adjust House Edge*

*Current:* `{current_edge}%`

⚠️ *Warning:*
House edge directly affects:
- Player win probability
- House profit margin
- RTP (Return To Player)

Standard range: 2.5% - 7.5%

*Select new value:* (or type custom)"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="2.5%", callback_data="algo_edge_2.5")],
            [InlineKeyboardButton(text="3.5%", callback_data="algo_edge_3.5")],
            [InlineKeyboardButton(text="5.0%", callback_data="algo_edge_5.0")],
            [InlineKeyboardButton(text="7.0%", callback_data="algo_edge_7.0")],
            [InlineKeyboardButton(text="❌ Cancel", callback_data="algo_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data.startswith("algo_edge_"))
@admin_required
async def set_house_edge(query: CallbackQuery, session_maker):
    """Set house edge to specific value"""
    
    new_edge = query.data.replace("algo_edge_", "")
    
    async with session_maker() as session:
        try:
            old_edge = await get_house_edge_percentage(session)
            
            # Validate range
            edge_value = float(new_edge)
            if not (0.1 <= edge_value <= 50.0):
                await query.answer("House edge must be between 0.1% and 50%", show_alert=True)
                return
            
            # Update setting
            await SystemSettingsService.set_setting(
                session,
                key=SettingKey.HOUSE_EDGE_PERCENTAGE,
                value=str(edge_value),
                category='game_algorithms',
                admin_id=query.from_user.id,
            )
            
            # Log change
            await AuditLogService.log_algorithm_config_change(
                session,
                admin_id=query.from_user.id,
                old_algorithm='FIXED_HOUSE_EDGE',
                new_algorithm='FIXED_HOUSE_EDGE',
                old_config={'house_edge_percentage': old_edge},
                new_config={'house_edge_percentage': edge_value},
                change_reason="Admin adjusted house edge via Telegram",
                ip_address=None,
            )
            
            await session.commit()
            
            text = f"""✅ *House Edge Updated*

📊 *Old Edge:* `{old_edge}%`
📊 *New Edge:* `{edge_value}%`

*Implications:*
💰 RTP: `{100.0 - edge_value}%`
📈 House Profit: `{edge_value}%` per round

*Effect:*
Affects all NEW game sessions.
Active sessions unchanged."""
            
            await query.message.edit_text(text, parse_mode='Markdown')
            
        except Exception as e:
            await query.answer(f"Error: {str(e)}", show_alert=True)


@router.callback_query(F.data == "algo_view_history")
@admin_required
async def view_algo_change_history(query: CallbackQuery, session_maker):
    """View algorithm change history"""
    
    async with session_maker() as session:
        history_query = (
            select(AuditLog)
            .where(AuditLog.action == 'ALGORITHM_CONFIG_CHANGED')
            .order_by(AuditLog.created_at.desc())
            .limit(10)
        )
        result = await session.execute(history_query)
        logs = result.scalars().all()
        
        if not logs:
            text = "📋 No algorithm changes recorded yet"
        else:
            text = "📋 *Algorithm Change History* (Last 10)\n\n"
            for log in logs:
                old = log.details.get('old_algorithm', 'N/A')
                new = log.details.get('new_algorithm', 'N/A')
                timestamp = log.created_at.strftime('%Y-%m-%d %H:%M:%S')
                text += f"• {timestamp}: `{old}` → `{new}`\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="algo_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "algo_view_stats")
@admin_required
async def view_algorithm_stats(query: CallbackQuery, session_maker):
    """View algorithm performance statistics"""
    
    async with session_maker() as session:
        # Count sessions by algorithm
        query_fixed = select(func.count(GameSession.id)).where(GameSession.algorithm_used == 'FIXED_HOUSE_EDGE')
        result = await session.execute(query_fixed)
        count_fixed = result.scalar() or 0
        
        query_dynamic = select(func.count(GameSession.id)).where(GameSession.algorithm_used == 'DYNAMIC')
        result = await session.execute(query_dynamic)
        count_dynamic = result.scalar() or 0
        
        # Win rates
        from sqlalchemy import and_
        query_wins = select(func.count(GameRound.id)).where(
            and_(GameRound.result == 'WIN', GameRound.algorithm_used == 'FIXED_HOUSE_EDGE')
        )
        result = await session.execute(query_wins)
        wins_fixed = result.scalar() or 0
        
        query_total = select(func.count(GameRound.id)).where(GameRound.algorithm_used == 'FIXED_HOUSE_EDGE')
        result = await session.execute(query_total)
        total_fixed = result.scalar() or 1  # Avoid division by zero
        
        win_rate_fixed = (wins_fixed / total_fixed * 100) if total_fixed > 0 else 0
        
        text = f"""📊 *Algorithm Performance Statistics*

💎 *FIXED_HOUSE_EDGE*
   Sessions: `{count_fixed}`
   Win Rate: `{win_rate_fixed:.1f}%`
   Status: Active

🧠 *DYNAMIC*
   Sessions: `{count_dynamic}`
   Status: {'Active' if count_dynamic > 0 else 'Inactive'}

⚠️ Note:
Statistics are for monitoring only.
All outcomes are immutable and auditable."""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="algo_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "algo_emergency_reset")
@admin_required
async def algo_emergency_reset(query: CallbackQuery):
    """Emergency reset confirmation"""
    
    text = """⚠️ *Emergency Reset - Confirm Action*

This will reset algorithm mode to FIXED_HOUSE_EDGE (safest default).

*This does NOT affect:*
✓ Existing game sessions
✓ Past outcomes (immutable)
✓ Commission records

*Only use if system behaves unexpectedly.*

*Are you sure?*"""
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Confirm Reset", callback_data="algo_confirm_reset"),
            InlineKeyboardButton(text="❌ Cancel", callback_data="algo_back_menu")
        ]
    ])
    
    await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "algo_confirm_reset")
@admin_required
async def execute_algo_emergency_reset(query: CallbackQuery, session_maker):
    """Execute emergency reset"""
    
    async with session_maker() as session:
        old_algo = await get_game_algorithm_mode(session)
        
        await SystemSettingsService.set_setting(
            session,
            key=SettingKey.GAME_ALGORITHM_MODE,
            value='FIXED_HOUSE_EDGE',
            admin_id=query.from_user.id,
        )
        
        await AuditLogService.log_algorithm_config_change(
            session,
            admin_id=query.from_user.id,
            old_algorithm=old_algo,
            new_algorithm='FIXED_HOUSE_EDGE',
            change_reason="Emergency reset initiated by admin",
            ip_address=None,
        )
        
        await session.commit()
        
        text = """✅ *Emergency Reset Complete*

🎮 Algorithm reset to `FIXED_HOUSE_EDGE`
⏰ All new games will use conservative, transparent algorithm

System is now in safe mode."""
        
        await query.message.edit_text(text, parse_mode='Markdown')


@router.callback_query(F.data.in_(["algo_back_menu", "algo_cancel_change"]))
async def algo_back_to_menu(query: CallbackQuery):
    """Go back to main menu"""
    await algorithm_settings_menu(query.message, query.message.bot.session)
