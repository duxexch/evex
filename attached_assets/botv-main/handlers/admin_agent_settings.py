#!/usr/bin/env python3
"""
Admin handlers for agent distribution settings
Allows admins to view/change distribution mode via Telegram
"""

from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.filters import Command
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models import Agent, Outbox, OutboxStatus, AuditLog
from services.system_settings_service import (
    SystemSettingsService, 
    SettingKey,
    get_agent_distribution_mode,
    is_agent_distribution_enabled
)
from services.agent_distribution_service import AgentDistributionService
from services.audit_log_service import AuditLogService
from utils.auth import admin_required
from services.i18n import get_text

router = Router()


@router.message(Command('agent_settings'))
@admin_required
async def agent_settings_menu(message: Message, session_maker):
    """Show agent distribution settings menu"""
    
    async with session_maker() as session:
        # Get current settings
        current_mode = await get_agent_distribution_mode(session)
        is_enabled = await is_agent_distribution_enabled(session)
        
        # Get active agents count
        query = select(func.count(Agent.id)).where(Agent.is_active == True)
        result = await session.execute(query)
        active_agents_count = result.scalar() or 0
        
        # Build message
        text = f"""⚙️ *{get_text('agent_settings', message.from_user.language_code or 'ar')}*

*Current Configuration:*
🔄 *Distribution Mode:* `{current_mode}`
🔌 *Feature Enabled:* {'✅ Yes' if is_enabled else '❌ No'}
👥 *Active Agents:* `{active_agents_count}`

*Available Modes:*
• 🔧 `MANUAL` - Admin selects agent (Default - Safest)
• 🔄 `AUTO_ROUND_ROBIN` - Fair rotation (Requires feature flag)
• ⚖️ `AUTO_LOAD_BASED` - Intelligent distribution (Requires feature flag)

*What would you like to do?*"""
        
        # Build keyboard
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📊 View Current Mode",
                    callback_data="agent_view_mode"
                ),
                InlineKeyboardButton(
                    text="🔄 Change Mode",
                    callback_data="agent_change_mode"
                )
            ],
            [
                InlineKeyboardButton(
                    text="👥 View Agents",
                    callback_data="agent_list_agents"
                ),
                InlineKeyboardButton(
                    text="📈 View Load",
                    callback_data="agent_view_load"
                )
            ],
            [
                InlineKeyboardButton(
                    text="📋 View History",
                    callback_data="agent_view_history"
                ),
                InlineKeyboardButton(
                    text="⚠️ Emergency Reset",
                    callback_data="agent_emergency_reset"
                )
            ]
        ])
        
        await message.answer(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "agent_view_mode")
@admin_required
async def view_current_mode(query: CallbackQuery, session_maker):
    """View current distribution mode details"""
    
    async with session_maker() as session:
        mode = await get_agent_distribution_mode(session)
        is_enabled = await is_agent_distribution_enabled(session)
        
        mode_descriptions = {
            'MANUAL': '🔧 Admin-selected\nEach request requires manual agent selection\nSafest option, full control',
            'AUTO_ROUND_ROBIN': '🔄 Fair rotation\nSequentially rotates through active agents\nStateless, predictable distribution',
            'AUTO_LOAD_BASED': '⚖️ Intelligent load distribution\nAssigns to agent with lowest workload\nResponsive, efficient',
        }
        
        text = f"""*Current Agent Distribution Mode*

📌 *Active Mode:* `{mode}`
🔌 *Feature Enabled:* {'✅ Yes' if is_enabled else '❌ No'}

*Description:*
{mode_descriptions.get(mode, 'Unknown mode')}

*Last 5 changes:*
"""
        
        # Get recent mode changes
        query = (
            select(AuditLog)
            .where(AuditLog.action == 'DISTRIBUTION_MODE_CHANGED')
            .order_by(AuditLog.created_at.desc())
            .limit(5)
        )
        result = await session.execute(query)
        logs = result.scalars().all()
        
        if logs:
            for log in logs:
                old_mode = log.details.get('old_mode', 'N/A')
                new_mode = log.details.get('new_mode', 'N/A')
                timestamp = log.created_at.strftime('%Y-%m-%d %H:%M')
                text += f"\n• {timestamp}: `{old_mode}` → `{new_mode}`"
        else:
            text += "\n• No changes recorded"
        
        await query.message.edit_text(text, parse_mode='Markdown')


@router.callback_query(F.data == "agent_change_mode")
@admin_required
async def change_mode_menu(query: CallbackQuery, session_maker):
    """Show mode change options"""
    
    async with session_maker() as session:
        current_mode = await get_agent_distribution_mode(session)
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text="🔧 MANUAL (Admin-Selected)",
                callback_data="agent_switch_mode_manual"
            )],
            [InlineKeyboardButton(
                text="🔄 ROUND-ROBIN (Auto-Fair)",
                callback_data="agent_switch_mode_rr"
            )],
            [InlineKeyboardButton(
                text="⚖️ LOAD-BASED (Auto-Smart)",
                callback_data="agent_switch_mode_load"
            )],
            [InlineKeyboardButton(
                text="❌ Cancel",
                callback_data="agent_cancel_change"
            )]
        ])
        
        text = f"""*Switch Distribution Mode*

*Current:* `{current_mode}`

*Warning:* Switching modes only affects NEW requests.
In-flight requests will continue using their assigned mode.

*Select new mode:*"""
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data.startswith("agent_switch_mode_"))
@admin_required
async def execute_mode_switch(query: CallbackQuery, session_maker):
    """Execute mode switch"""
    
    mode_map = {
        'agent_switch_mode_manual': 'MANUAL',
        'agent_switch_mode_rr': 'AUTO_ROUND_ROBIN',
        'agent_switch_mode_load': 'AUTO_LOAD_BASED',
    }
    
    new_mode = mode_map.get(query.data, 'MANUAL')
    
    async with session_maker() as session:
        # Get old mode
        old_mode = await get_agent_distribution_mode(session)
        
        if old_mode == new_mode:
            await query.answer(f"Already using {new_mode} mode", show_alert=True)
            return
        
        try:
            # Update setting
            await SystemSettingsService.set_setting(
                session,
                key=SettingKey.AGENT_DISTRIBUTION_MODE,
                value=new_mode,
                category='agent_distribution',
                admin_id=query.from_user.id,
            )
            
            # Log change
            await AuditLogService.log_distribution_mode_change(
                session,
                admin_id=query.from_user.id,
                old_mode=old_mode,
                new_mode=new_mode,
                change_reason="Admin initiated via Telegram",
                ip_address=None,
            )
            
            await session.commit()
            
            text = f"""✅ *Mode Switched Successfully*

🔄 *Old Mode:* `{old_mode}`
🔄 *New Mode:* `{new_mode}`
⏰ *Time:* `{query.message.date.strftime('%Y-%m-%d %H:%M:%S')}`

*Effect:*
✓ Affects NEW requests immediately
✓ In-flight requests unchanged
✓ Change logged to audit trail

*Next Steps:*
New financial requests will be assigned using `{new_mode}` strategy."""
            
            await query.message.edit_text(text, parse_mode='Markdown')
            
            # Notify other admins
            await query.answer(f"Mode switched to {new_mode}", show_alert=True)
            
        except Exception as e:
            error_text = f"❌ *Error switching mode*\n\n`{str(e)}`"
            await query.message.edit_text(error_text, parse_mode='Markdown')
            await query.answer("Error occurred", show_alert=True)


@router.callback_query(F.data == "agent_list_agents")
@admin_required
async def list_agents(query: CallbackQuery, session_maker):
    """List all agents with status"""
    
    async with session_maker() as session:
        query_agents = select(Agent).order_by(Agent.name)
        result = await session.execute(query_agents)
        agents = result.scalars().all()
        
        if not agents:
            text = "❌ *No agents found*\n\nCreate an agent to enable agent distribution."
        else:
            text = f"""👥 *Active Agents* ({len(agents)})

"""
            for agent in agents:
                status_icon = '🟢' if agent.status.value == 'active' else '🔴'
                text += f"""{status_icon} *{agent.name}*
   Code: `{agent.agent_code}`
   Commission: {float(agent.commission_rate_deposit)*100:.1f}% / {float(agent.commission_rate_withdraw)*100:.1f}%
   Processed: ${float(agent.total_deposits_processed):.2f} / ${float(agent.total_withdrawals_processed):.2f}
   Earned: ${float(agent.total_commission_earned):.2f}

"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="agent_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "agent_view_load")
@admin_required
async def view_agent_load(query: CallbackQuery, session_maker):
    """View current agent load distribution"""
    
    async with session_maker() as session:
        agents = await AgentDistributionService.get_active_agents(session)
        
        if not agents:
            text = "❌ No active agents available"
            await query.message.edit_text(text, parse_mode='Markdown')
            return
        
        text = "📊 *Agent Load Distribution*\n\n"
        
        for agent in agents:
            # Count pending requests
            count_query = select(func.count(Outbox.id)).where(
                (Outbox.assigned_agent_id == agent.id) &
                (Outbox.status.in_([OutboxStatus.PENDING, OutboxStatus.PROCESSING]))
            )
            result = await session.execute(count_query)
            pending_count = result.scalar() or 0
            
            load_bar = "█" * min(pending_count, 10) + "░" * max(0, 10 - pending_count)
            text += f"""`{agent.agent_code}` {load_bar} {pending_count}
"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="agent_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "agent_view_history")
@admin_required
async def view_assignment_history(query: CallbackQuery, session_maker):
    """View recent agent assignments"""
    
    async with session_maker() as session:
        history_query = (
            select(AuditLog)
            .where(AuditLog.action.like('AGENT_ASSIGNED_%'))
            .order_by(AuditLog.created_at.desc())
            .limit(10)
        )
        result = await session.execute(history_query)
        logs = result.scalars().all()
        
        if not logs:
            text = "📋 No assignments recorded yet"
        else:
            text = "📋 *Recent Agent Assignments* (Last 10)\n\n"
            for log in logs:
                strategy = log.details.get('strategy', 'N/A')
                agent_id = log.details.get('assigned_agent_id', 'N/A')
                timestamp = log.created_at.strftime('%H:%M:%S')
                text += f"• {timestamp} → Agent `{agent_id}` ({strategy})\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="agent_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "agent_emergency_reset")
@admin_required
async def emergency_reset_menu(query: CallbackQuery, session_maker):
    """Emergency reset confirmation"""
    
    text = """⚠️ *Emergency Reset - Confirm Action*

This will reset distribution mode to MANUAL (safest default).
This does NOT affect:
✓ Existing requests
✓ Agent data
✓ Commission records

Only use if system behaves unexpectedly.

*Are you sure?*"""
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Confirm Reset", callback_data="agent_confirm_reset"),
            InlineKeyboardButton(text="❌ Cancel", callback_data="agent_back_menu")
        ]
    ])
    
    await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "agent_confirm_reset")
@admin_required
async def execute_emergency_reset(query: CallbackQuery, session_maker):
    """Execute emergency reset"""
    
    async with session_maker() as session:
        old_mode = await get_agent_distribution_mode(session)
        
        await SystemSettingsService.set_setting(
            session,
            key=SettingKey.AGENT_DISTRIBUTION_MODE,
            value='MANUAL',
            admin_id=query.from_user.id,
        )
        
        await AuditLogService.log_distribution_mode_change(
            session,
            admin_id=query.from_user.id,
            old_mode=old_mode,
            new_mode='MANUAL',
            change_reason="Emergency reset initiated by admin",
            ip_address=None,
        )
        
        await session.commit()
        
        text = f"""✅ *Emergency Reset Complete*

🔄 Mode reset to `MANUAL`
⏰ All new requests will require manual agent assignment

System is now in safe mode."""
        
        await query.message.edit_text(text, parse_mode='Markdown')


@router.callback_query(F.data.in_(["agent_back_menu", "agent_cancel_change"]))
async def back_to_menu(query: CallbackQuery):
    """Go back to main menu"""
    await agent_settings_menu(query.message, query.message.bot.session)
