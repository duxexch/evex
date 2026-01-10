#!/usr/bin/env python3
"""
Admin handlers for audit log viewing
Comprehensive auditing of algorithm changes and game events
"""

from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery, Document, FSInputFile
from aiogram.filters import Command
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
import json
import csv
import io

from models import AuditLog, GameSession, GameRound, Outbox
from utils.auth import admin_required
from services.i18n import get_text

router = Router()


@router.message(Command('audit_logs'))
@admin_required
async def view_audit_logs(message: Message, session_maker):
    """Show audit logs menu"""
    
    async with session_maker() as session:
        # Count different types of audit logs
        total_logs = await session.execute(select(func.count(AuditLog.id)))
        total_count = total_logs.scalar() or 0
        
        algo_logs = await session.execute(
            select(func.count(AuditLog.id)).where(AuditLog.action == 'ALGORITHM_CONFIG_CHANGED')
        )
        algo_count = algo_logs.scalar() or 0
        
        game_logs = await session.execute(
            select(func.count(AuditLog.id)).where(AuditLog.action.in_(['GAME_STARTED', 'GAME_COMPLETED']))
        )
        game_count = game_logs.scalar() or 0
        
        text = f"""📋 *Audit Log Dashboard*

📊 *Total Logs:* `{total_count}`
🎮 *Game Events:* `{game_count}`
⚙️ *Algorithm Changes:* `{algo_count}`

*What would you like to view?*"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="📋 Recent Logs", callback_data="audit_view_recent"),
                InlineKeyboardButton(text="⚙️ Algorithm Changes", callback_data="audit_algo_changes")
            ],
            [
                InlineKeyboardButton(text="🎮 Game Events", callback_data="audit_game_events"),
                InlineKeyboardButton(text="📅 Export Report", callback_data="audit_export_report")
            ],
            [
                InlineKeyboardButton(text="🔍 Search", callback_data="audit_search"),
                InlineKeyboardButton(text="📊 Statistics", callback_data="audit_stats")
            ]
        ])
        
        await message.answer(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "audit_view_recent")
@admin_required
async def view_recent_logs(query: CallbackQuery, session_maker):
    """View recent audit logs"""
    
    async with session_maker() as session:
        logs_query = (
            select(AuditLog)
            .order_by(desc(AuditLog.created_at))
            .limit(20)
        )
        result = await session.execute(logs_query)
        logs = result.scalars().all()
        
        text = "📋 *Recent Audit Logs* (Last 20)\n\n"
        
        if not logs:
            text += "No logs recorded yet"
        else:
            for log in logs:
                timestamp = log.created_at.strftime('%H:%M:%S')
                action = log.action.replace('_', ' ').title()
                text += f"• `{timestamp}` - {action}\n"
                if log.admin_id:
                    text += f"  👤 Admin: `{log.admin_id}`\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📋 View Full Details", callback_data="audit_full_details")],
            [InlineKeyboardButton(text="🔙 Back", callback_data="audit_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "audit_algo_changes")
@admin_required
async def view_algo_changes(query: CallbackQuery, session_maker):
    """View algorithm configuration changes"""
    
    async with session_maker() as session:
        logs_query = (
            select(AuditLog)
            .where(AuditLog.action == 'ALGORITHM_CONFIG_CHANGED')
            .order_by(desc(AuditLog.created_at))
            .limit(15)
        )
        result = await session.execute(logs_query)
        logs = result.scalars().all()
        
        text = "⚙️ *Algorithm Configuration Changes*\n\n"
        
        if not logs:
            text += "No algorithm changes recorded"
        else:
            for log in logs:
                details = log.details or {}
                old_algo = details.get('old_algorithm', '?')
                new_algo = details.get('new_algorithm', '?')
                timestamp = log.created_at.strftime('%Y-%m-%d %H:%M')
                
                text += f"• `{timestamp}`\n"
                text += f"  `{old_algo}` → `{new_algo}`\n"
                if log.admin_id:
                    text += f"  👤 By: `{log.admin_id}`\n"
                text += "\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📥 Download Full Log", callback_data="audit_download_algo_log")],
            [InlineKeyboardButton(text="🔙 Back", callback_data="audit_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "audit_game_events")
@admin_required
async def view_game_events(query: CallbackQuery, session_maker):
    """View game-related audit events"""
    
    async with session_maker() as session:
        # Count games by algorithm
        fixed_games = await session.execute(
            select(func.count(GameSession.id)).where(GameSession.algorithm_used == 'FIXED_HOUSE_EDGE')
        )
        fixed_count = fixed_games.scalar() or 0
        
        dynamic_games = await session.execute(
            select(func.count(GameSession.id)).where(GameSession.algorithm_used == 'DYNAMIC')
        )
        dynamic_count = dynamic_games.scalar() or 0
        
        # Get recent game logs
        logs_query = (
            select(AuditLog)
            .where(AuditLog.action.in_(['GAME_STARTED', 'GAME_COMPLETED']))
            .order_by(desc(AuditLog.created_at))
            .limit(10)
        )
        result = await session.execute(logs_query)
        logs = result.scalars().all()
        
        text = f"""🎮 *Game Events*

📊 Total Games:
💎 FIXED_HOUSE_EDGE: `{fixed_count}`
🧠 DYNAMIC: `{dynamic_count}`

*Recent Events:*
"""
        
        if logs:
            for log in logs:
                timestamp = log.created_at.strftime('%H:%M:%S')
                action = log.action.replace('_', ' ')
                text += f"• `{timestamp}` - {action}\n"
        else:
            text += "No game events recorded"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📊 Detailed Stats", callback_data="audit_game_stats")],
            [InlineKeyboardButton(text="🔙 Back", callback_data="audit_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "audit_stats")
@admin_required
async def view_audit_stats(query: CallbackQuery, session_maker):
    """View audit statistics"""
    
    async with session_maker() as session:
        # Count logs by action
        actions_query = select(AuditLog.action, func.count(AuditLog.id)).group_by(AuditLog.action)
        result = await session.execute(actions_query)
        action_counts = result.all()
        
        # Time ranges
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        hour_logs = await session.execute(
            select(func.count(AuditLog.id)).where(AuditLog.created_at >= hour_ago)
        )
        hour_count = hour_logs.scalar() or 0
        
        day_logs = await session.execute(
            select(func.count(AuditLog.id)).where(AuditLog.created_at >= day_ago)
        )
        day_count = day_logs.scalar() or 0
        
        text = "📊 *Audit Statistics*\n\n"
        text += f"*Time Ranges:*\n"
        text += f"📌 Last Hour: `{hour_count}`\n"
        text += f"📌 Last 24h: `{day_count}`\n\n"
        
        text += "*Events by Type:*\n"
        for action, count in action_counts:
            text += f"• {action}: `{count}`\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back", callback_data="audit_back_menu")]
        ])
        
        await query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')


@router.callback_query(F.data == "audit_export_report")
@admin_required
async def export_audit_report(query: CallbackQuery, session_maker):
    """Export audit logs as CSV"""
    
    async with session_maker() as session:
        logs_query = (
            select(AuditLog)
            .order_by(desc(AuditLog.created_at))
            .limit(1000)  # Export last 1000 logs
        )
        result = await session.execute(logs_query)
        logs = result.scalars().all()
        
        # Create CSV
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        
        # Headers
        writer.writerow(['Timestamp', 'Action', 'Admin ID', 'Details', 'IP Address'])
        
        # Data
        for log in logs:
            details_json = json.dumps(log.details or {})
            writer.writerow([
                log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                log.action,
                log.admin_id or 'N/A',
                details_json,
                log.ip_address or 'N/A'
            ])
        
        # Create file
        csv_data = csv_buffer.getvalue()
        csv_buffer.close()
        
        # Send as document
        file_name = f"audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Convert string to bytes and create InputFile
        from aiogram.types import BufferedInputFile
        file = BufferedInputFile(
            file_data=csv_data.encode('utf-8'),
            filename=file_name
        )
        
        await query.message.answer_document(
            document=file,
            caption=f"📊 Audit Report\n\n✅ Exported {len(logs)} records"
        )
        
        await query.answer("Report exported", show_alert=False)


@router.callback_query(F.data == "audit_back_menu")
async def audit_back_to_menu(query: CallbackQuery):
    """Back to audit menu"""
    message_obj = query.message
    message_obj.from_user = query.from_user
    await view_audit_logs(message_obj, None)
