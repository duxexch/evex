#!/usr/bin/env python3
"""
Flying Plane Game Telegram Handler
Integrates Flying Plane game with Telegram bot commands
"""

import logging
from decimal import Decimal
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession

from handlers.flying_plane_game import handle_flying_plane_command
from services.i18n import get_text, get_user_language
from models import User
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = Router()

@router.message(Command("play_flying_plane"))
async def cmd_play_flying_plane(message: Message, state: FSMContext, session_maker):
    """
    Handle /play_flying_plane command
    
    Usage: /play_flying_plane <stake_amount>
    Example: /play_flying_plane 1000
    """
    try:
        # Parse stake amount from command
        args = message.text.split(maxsplit=1)
        
        if len(args) < 2:
            await message.answer(
                "❌ Invalid command format.\n\n"
                "Usage: /play_flying_plane <stake_amount>\n"
                "Example: /play_flying_plane 1000\n\n"
                "Stake amount must be a positive number."
            )
            return
        
        try:
            stake_amount = Decimal(args[1])
            
            if stake_amount <= 0:
                await message.answer(
                    "❌ Stake amount must be greater than 0.\n"
                    "Please try again with a valid amount."
                )
                return
                
        except (ValueError, TypeError):
            await message.answer(
                "❌ Invalid stake amount.\n"
                "Please enter a valid number.\n\n"
                "Example: /play_flying_plane 1000"
            )
            return
        
        # Get user ID
        user_id = message.from_user.id
        
        # Send "game starting" message
        await message.answer(
            "🎮 <b>Flying Plane Game Starting...</b>\n\n"
            f"💰 Stake: {stake_amount:,.2f} SAR\n"
            f"🎯 Target Score: 500+ (WIN)\n"
            f"⚠️ Score < 500 (LOSS)\n\n"
            "⏳ Game in progress...",
            parse_mode="HTML"
        )
        
        # Execute game session
        logger.info(f"User {user_id} started Flying Plane game with stake {stake_amount}")
        
        result = await handle_flying_plane_command(
            user_id=user_id,
            stakes=stake_amount,
            session_maker=session_maker
        )
        
        # Format result message
        is_win = result.get('is_win', False)
        final_score = result.get('final_score', 0)
        time_steps = result.get('total_time_steps', 0)
        payout_percent = result.get('payout_percent', 0)
        payout_amount = result.get('payout_amount', Decimal('0'))
        profit_loss = result.get('profit_loss', Decimal('0'))
        max_speed = result.get('max_speed_reached', 1.0)
        
        # Determine outcome emoji
        outcome_emoji = "🎉" if is_win else "😞"
        outcome_text = "WIN" if is_win else "LOSS"
        
        # Build result message
        result_message = (
            f"{outcome_emoji} <b>Game Over - {outcome_text}</b> {outcome_emoji}\n\n"
            f"📊 <b>Game Results:</b>\n"
            f"├ Final Score: <b>{final_score}</b>\n"
            f"├ Time Steps: {time_steps}\n"
            f"├ Max Speed: {max_speed:.1f}x\n"
            f"└ Status: {'✅ WIN' if is_win else '❌ LOSS'}\n\n"
            f"💰 <b>Financial Summary:</b>\n"
            f"├ Stake: {stake_amount:,.2f} SAR\n"
            f"├ Payout %: {payout_percent:.1f}%\n"
            f"├ Payout Amount: {payout_amount:,.2f} SAR\n"
            f"└ Profit/Loss: {profit_loss:+,.2f} SAR\n\n"
        )
        
        # Add motivational message
        if is_win:
            result_message += (
                "🎊 Congratulations! You avoided all obstacles!\n"
                "🌟 Your flying skills are impressive!\n"
            )
        else:
            result_message += (
                "💪 Don't give up! Try again to improve your score!\n"
                "🎯 Aim for 500+ points to win!\n"
            )
        
        result_message += "\n🎮 Play again: /play_flying_plane <amount>"
        
        # Send result to user
        await message.answer(result_message, parse_mode="HTML")
        
        # Log game completion
        logger.info(
            f"Flying Plane game completed for user {user_id}: "
            f"Score={final_score}, Win={is_win}, Payout={payout_amount}"
        )
        
    except Exception as e:
        logger.error(f"Error in Flying Plane game handler: {e}", exc_info=True)
        await message.answer(
            "❌ An error occurred while playing the game.\n"
            "Please try again later or contact support.\n\n"
            "Error details have been logged for review."
        )


@router.message(Command("flying_plane_help"))
async def cmd_flying_plane_help(message: Message):
    """Show Flying Plane game help and instructions"""
    help_text = (
        "🎮 <b>Flying Plane Game - Help</b>\n\n"
        "<b>How to Play:</b>\n"
        "1. Use command: /play_flying_plane <stake_amount>\n"
        "2. The plane flies horizontally and avoids obstacles\n"
        "3. Game lasts 20 time steps (auto-play)\n"
        "4. Score increases for each successful step\n"
        "5. Speed increases as you progress\n\n"
        "<b>Winning Conditions:</b>\n"
        "• Score ≥ 500: WIN (100-150% payout)\n"
        "• Score < 500: LOSS (0% payout)\n\n"
        "<b>Game Mechanics:</b>\n"
        "• Obstacles spawn from the right\n"
        "• Obstacles move left at increasing speed\n"
        "• Speed increases every 100 points\n"
        "• Base speed: 1.0x → Max speed: 5.0x\n\n"
        "<b>Anti-Cheat:</b>\n"
        "• All games are logged and monitored\n"
        "• Suspicious scores (>1000) are flagged\n"
        "• Game sessions tracked in CSV files\n\n"
        "<b>Examples:</b>\n"
        "• /play_flying_plane 1000 (stake 1000 SAR)\n"
        "• /play_flying_plane 500 (stake 500 SAR)\n\n"
        "<b>Admin Testing:</b>\n"
        "• Admin balance: 10,000,000,000 SAR (constant)\n"
        "• Test mode: Balance not deducted\n\n"
        "🎯 Good luck and aim high!"
    )
    
    await message.answer(help_text, parse_mode="HTML")


@router.message(Command("flying_plane_stats"))
async def cmd_flying_plane_stats(message: Message, session_maker):
    """Show user's Flying Plane game statistics"""
    try:
        user_id = message.from_user.id
        
        # Read flying_plane_scores.csv
        from services.domain_services.csv_manager import csv_manager
        
        scores = csv_manager.read_all("flying_plane_scores")
        
        # Filter user's scores
        user_scores = [s for s in scores if s.get('user_id') == str(user_id)]
        
        if not user_scores:
            await message.answer(
                "📊 <b>Your Flying Plane Statistics</b>\n\n"
                "You haven't played any games yet.\n\n"
                "Start playing: /play_flying_plane <amount>",
                parse_mode="HTML"
            )
            return
        
        # Calculate statistics
        total_games = len(user_scores)
        total_wins = sum(1 for s in user_scores if s.get('is_win') == 'yes')
        total_losses = total_games - total_wins
        win_rate = (total_wins / total_games * 100) if total_games > 0 else 0
        
        best_score = max(int(s.get('score', 0)) for s in user_scores)
        avg_score = sum(int(s.get('score', 0)) for s in user_scores) / total_games
        
        stats_text = (
            "📊 <b>Your Flying Plane Statistics</b>\n\n"
            f"🎮 <b>Games Played:</b> {total_games}\n"
            f"✅ <b>Wins:</b> {total_wins}\n"
            f"❌ <b>Losses:</b> {total_losses}\n"
            f"📈 <b>Win Rate:</b> {win_rate:.1f}%\n\n"
            f"🏆 <b>Best Score:</b> {best_score}\n"
            f"📊 <b>Average Score:</b> {avg_score:.1f}\n\n"
            "🎯 Keep playing to improve your stats!\n"
            "Play now: /play_flying_plane <amount>"
        )
        
        await message.answer(stats_text, parse_mode="HTML")
        
    except Exception as e:
        logger.error(f"Error fetching Flying Plane stats: {e}", exc_info=True)
        await message.answer(
            "❌ Error fetching statistics.\n"
            "Please try again later."
        )
