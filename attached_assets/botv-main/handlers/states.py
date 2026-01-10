"""
Telegram FSM (Finite State Machine) states for multi-step operations
"""

from aiogram.fsm.state import State, StatesGroup


class DepositStates(StatesGroup):
    """Deposit operation states"""
    waiting_for_amount = State()
    waiting_for_method = State()
    waiting_for_confirmation = State()
    waiting_for_receipt = State()


class WithdrawalStates(StatesGroup):
    """Withdrawal operation states"""
    waiting_for_amount = State()
    waiting_for_wallet = State()
    waiting_for_method = State()
    waiting_for_confirmation = State()


class SupportStates(StatesGroup):
    """Support ticket states"""
    waiting_for_category = State()
    waiting_for_message = State()
    waiting_for_confirmation = State()


class AdminStates(StatesGroup):
    """Admin panel states"""
    waiting_for_user_id = State()
    waiting_for_action = State()
    waiting_for_amount = State()
    waiting_for_reason = State()
    waiting_for_confirmation = State()
