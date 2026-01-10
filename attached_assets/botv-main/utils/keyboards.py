#!/usr/bin/env python3
"""
Keyboard utilities - لوحات المفاتيح
Handles all keyboard layouts for different bot functions
"""

from typing import List, Optional
from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, 
    InlineKeyboardButton
)
from aiogram.utils.keyboard import ReplyKeyboardBuilder, InlineKeyboardBuilder

from services.i18n import get_text

def get_main_menu_keyboard(language: str = "ar", is_admin: bool = False) -> ReplyKeyboardMarkup:
    """Create main menu reply keyboard - القائمة الرئيسية"""
    builder = ReplyKeyboardBuilder()
    
    # Row 1: Deposit & Withdraw
    builder.row(
        KeyboardButton(text='💰 طلب إيداع'),
        KeyboardButton(text='💸 طلب سحب')
    )
    
    # Row 2: My Requests & Profile
    builder.row(
        KeyboardButton(text='📋 طلباتي'),
        KeyboardButton(text='👤 حسابي')
    )
    
    # Row 3: Complaints & Support
    builder.row(
        KeyboardButton(text='📨 شكوى'),
        KeyboardButton(text='🆘 دعم')
    )
    
    # Row 4: Change Currency & Reset
    builder.row(
        KeyboardButton(text='💱 تغيير العملة'),
        KeyboardButton(text='🔄 إعادة تعيين')
    )
    
    # Row 5: Wallet & Affiliate (New Features)
    builder.row(
        KeyboardButton(text='💰 محفظتي'),
        KeyboardButton(text='🤝 برنامج الإحالة')
    )
    
    # Admin Button
    if is_admin:
        builder.row(
            KeyboardButton(text='⚙️ لوحة التحكم')
        )
    
    return builder.as_markup(resize_keyboard=True, one_time_keyboard=False)

def get_phone_share_keyboard(language: str = "ar") -> ReplyKeyboardMarkup:
    """Create phone sharing keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(
            text=get_text("share_phone", language),
            request_contact=True
        )
    )
    
    return builder.as_markup(resize_keyboard=True, one_time_keyboard=True)

def get_contact_confirmation_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create contact confirmation keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("confirm", language),
            callback_data="confirm_phone"
        )
    )
    
    return builder.as_markup()

def get_settings_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create settings menu keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("change_language", language),
            callback_data="change_language"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("change_country", language),
            callback_data="change_country"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("toggle_notifications", language),
            callback_data="toggle_notifications"
        )
    )
    
    return builder.as_markup()

def get_language_selection_keyboard(languages, current_language: str, 
                                  ui_language: str = "ar") -> InlineKeyboardMarkup:
    """Create language selection keyboard"""
    builder = InlineKeyboardBuilder()
    
    for lang in languages:
        # Add checkmark for current language
        text = lang.native_name
        if lang.code == current_language:
            text = f"✅ {text}"
        
        builder.row(
            InlineKeyboardButton(
                text=text,
                callback_data=f"lang_{lang.code}"
            )
        )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", ui_language),
            callback_data="back_to_settings"
        )
    )
    
    return builder.as_markup()

def get_country_selection_keyboard(countries, current_country: str,
                                 ui_language: str = "ar") -> InlineKeyboardMarkup:
    """Create country selection keyboard"""
    builder = InlineKeyboardBuilder()
    
    for country in countries:
        # Add checkmark for current country
        text = country.native_name
        if country.code == current_country:
            text = f"✅ {text}"
        
        builder.row(
            InlineKeyboardButton(
                text=text,
                callback_data=f"country_{country.code}"
            )
        )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", ui_language),
            callback_data="back_to_settings"
        )
    )
    
    return builder.as_markup()

def get_admin_panel_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create admin panel keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("admin_users", language),
            callback_data="admin_users"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("admin_languages", language),
            callback_data="admin_languages"
        ),
        InlineKeyboardButton(
            text=get_text("admin_countries", language),
            callback_data="admin_countries"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("admin_broadcast", language),
            callback_data="admin_broadcast"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("admin_outbox", language),
            callback_data="admin_outbox"
        )
    )
    
    return builder.as_markup()

def get_admin_users_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create admin users management keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("search_users", language),
            callback_data="search_users"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("user_statistics", language),
            callback_data="user_statistics"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", language),
            callback_data="back_to_admin"
        )
    )
    
    return builder.as_markup()

def get_admin_languages_keyboard(languages, language: str = "ar") -> InlineKeyboardMarkup:
    """Create admin languages management keyboard"""
    builder = InlineKeyboardBuilder()
    
    # Show toggle buttons for each language
    for lang in languages[:5]:  # Limit to 5 to avoid too long keyboards
        status_text = "✅" if lang.is_active else "❌"
        builder.row(
            InlineKeyboardButton(
                text=f"{status_text} {lang.native_name}",
                callback_data=f"toggle_lang_{lang.id}"
            )
        )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("add_language", language),
            callback_data="add_language"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", language),
            callback_data="back_to_admin"
        )
    )
    
    return builder.as_markup()

def get_admin_countries_keyboard(countries, language: str = "ar") -> InlineKeyboardMarkup:
    """Create admin countries management keyboard"""
    builder = InlineKeyboardBuilder()
    
    # Show toggle buttons for each country
    for country in countries[:5]:  # Limit to 5 to avoid too long keyboards
        status_text = "✅" if country.is_active else "❌"
        builder.row(
            InlineKeyboardButton(
                text=f"{status_text} {country.native_name}",
                callback_data=f"toggle_country_{country.id}"
            )
        )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("add_country", language),
            callback_data="add_country"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", language),
            callback_data="back_to_admin"
        )
    )
    
    return builder.as_markup()

def get_user_management_keyboard(user_id: int, language: str = "ar") -> InlineKeyboardMarkup:
    """Create user management keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("ban_user", language),
            callback_data=f"ban_user_{user_id}"
        ),
        InlineKeyboardButton(
            text=get_text("unban_user", language),
            callback_data=f"unban_user_{user_id}"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("promote_admin", language),
            callback_data=f"promote_admin_{user_id}"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", language),
            callback_data="admin_users"
        )
    )
    
    return builder.as_markup()

def get_pagination_keyboard(base_callback: str, current_page: int, 
                          total_pages: int, language: str = "ar") -> InlineKeyboardMarkup:
    """Create pagination keyboard"""
    builder = InlineKeyboardBuilder()
    
    buttons = []
    
    # Previous button
    if current_page > 0:
        buttons.append(
            InlineKeyboardButton(
                text="◀️",
                callback_data=f"{base_callback}_page_{current_page - 1}"
            )
        )
    
    # Current page indicator
    buttons.append(
        InlineKeyboardButton(
            text=f"{current_page + 1}/{total_pages}",
            callback_data="noop"
        )
    )
    
    # Next button
    if current_page < total_pages - 1:
        buttons.append(
            InlineKeyboardButton(
                text="▶️",
                callback_data=f"{base_callback}_page_{current_page + 1}"
            )
        )
    
    builder.row(*buttons)
    
    # Back button
    builder.row(
        InlineKeyboardButton(
            text=get_text("back", language),
            callback_data="back_to_admin"
        )
    )
    
    return builder.as_markup()

def get_broadcast_targeting_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create broadcast targeting keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("broadcast_all", language),
            callback_data="broadcast_all"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("broadcast_by_language", language),
            callback_data="broadcast_by_language"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("broadcast_by_country", language),
            callback_data="broadcast_by_country"
        )
    )
    
    return builder.as_markup()

def get_broadcast_confirmation_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create broadcast confirmation keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("confirm_broadcast", language),
            callback_data="confirm_broadcast"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("cancel_broadcast", language),
            callback_data="cancel_broadcast"
        )
    )
    
    return builder.as_markup()

def get_language_filter_keyboard(languages, ui_language: str = "ar") -> InlineKeyboardMarkup:
    """Create language filter keyboard for broadcasts"""
    builder = InlineKeyboardBuilder()
    
    for lang_code, lang_name, user_count in languages:
        builder.row(
            InlineKeyboardButton(
                text=f"{lang_name} ({user_count})",
                callback_data=f"lang_filter_{lang_code}"
            )
        )
    
    return builder.as_markup()

def get_country_filter_keyboard(countries, ui_language: str = "ar") -> InlineKeyboardMarkup:
    """Create country filter keyboard for broadcasts"""
    builder = InlineKeyboardBuilder()
    
    for country_code, country_name, user_count in countries:
        builder.row(
            InlineKeyboardButton(
                text=f"{country_name} ({user_count})",
                callback_data=f"country_filter_{country_code}"
            )
        )
    
    return builder.as_markup()

def get_announcement_menu_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create announcement menu keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("skip_image", language),
            callback_data="skip_image"
        )
    )
    
    return builder.as_markup()

def get_announcement_targeting_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create announcement targeting keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("announce_all", language),
            callback_data="announce_all"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("announce_by_language", language),
            callback_data="announce_by_language"
        )
    )
    
    return builder.as_markup()

def get_announcement_duration_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create announcement duration keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("duration_1h", language),
            callback_data="duration_1h"
        ),
        InlineKeyboardButton(
            text=get_text("duration_6h", language),
            callback_data="duration_6h"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("duration_24h", language),
            callback_data="duration_24h"
        ),
        InlineKeyboardButton(
            text=get_text("duration_7d", language),
            callback_data="duration_7d"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("duration_permanent", language),
            callback_data="duration_permanent"
        )
    )
    
    return builder.as_markup()

def get_announcement_confirmation_keyboard(language: str = "ar") -> InlineKeyboardMarkup:
    """Create announcement confirmation keyboard"""
    builder = InlineKeyboardBuilder()
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("confirm_announcement", language),
            callback_data="confirm_announcement"
        )
    )
    
    builder.row(
        InlineKeyboardButton(
            text=get_text("cancel_announcement", language),
            callback_data="cancel_announcement"
        )
    )
    
    return builder.as_markup()


# ==================== WALLET KEYBOARDS ====================

def get_wallet_menu_keyboard() -> ReplyKeyboardMarkup:
    """Wallet menu keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='💰 رصيدي'),
        KeyboardButton(text='📜 سجل المعاملات')
    )
    
    builder.row(
        KeyboardButton(text='⚙️ إعدادات المحفظة')
    )
    
    builder.row(
        KeyboardButton(text='🏠 القائمة الرئيسية')
    )
    
    return builder.as_markup(resize_keyboard=True)


def get_deposit_menu_keyboard() -> ReplyKeyboardMarkup:
    """Deposit menu keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='🏦 اختيار الشركة'),
        KeyboardButton(text='📊 آخر العمليات')
    )
    
    builder.row(
        KeyboardButton(text='⬅️ رجوع'),
        KeyboardButton(text='🏠 القائمة الرئيسية')
    )
    
    return builder.as_markup(resize_keyboard=True)


def get_withdrawal_menu_keyboard() -> ReplyKeyboardMarkup:
    """Withdrawal menu keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='🏦 اختيار الشركة'),
        KeyboardButton(text='📊 آخر العمليات')
    )
    
    builder.row(
        KeyboardButton(text='⬅️ رجوع'),
        KeyboardButton(text='🏠 القائمة الرئيسية')
    )
    
    return builder.as_markup(resize_keyboard=True)


def get_affiliate_menu_keyboard() -> ReplyKeyboardMarkup:
    """Affiliate program menu keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='📊 إحصائياتي'),
        KeyboardButton(text='💰 طلب سحب')
    )
    
    builder.row(
        KeyboardButton(text='📋 قائمة الإحالات')
    )
    
    builder.row(
        KeyboardButton(text='🏠 القائمة الرئيسية')
    )
    
    return builder.as_markup(resize_keyboard=True)


# ==================== ADMIN KEYBOARDS ====================

def get_admin_dashboard_keyboard() -> ReplyKeyboardMarkup:
    """Admin dashboard keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='👥 إدارة المستخدمين'),
        KeyboardButton(text='💰 إدارة الأرصدة')
    )
    
    builder.row(
        KeyboardButton(text='🤝 إدارة الوكلاء'),
        KeyboardButton(text='💵 إدارة العمولات')
    )
    
    builder.row(
        KeyboardButton(text='🏦 طرق الدفع'),
        KeyboardButton(text='📊 التقارير')
    )
    
    builder.row(
        KeyboardButton(text='🏠 القائمة الرئيسية')
    )
    
    return builder.as_markup(resize_keyboard=True)


def get_confirmation_keyboard() -> ReplyKeyboardMarkup:
    """Confirmation keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='✅ تأكيد'),
        KeyboardButton(text='❌ إلغاء')
    )
    
    return builder.as_markup(resize_keyboard=True)


def get_yes_no_keyboard() -> ReplyKeyboardMarkup:
    """Yes/No keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='✅ نعم'),
        KeyboardButton(text='❌ لا')
    )
    
    return builder.as_markup(resize_keyboard=True)


def get_back_to_main_keyboard() -> ReplyKeyboardMarkup:
    """Back to main menu keyboard"""
    builder = ReplyKeyboardBuilder()
    
    builder.row(
        KeyboardButton(text='🏠 القائمة الرئيسية')
    )
    
    return builder.as_markup(resize_keyboard=True)


# ==================== HELPER FUNCTIONS ====================

def get_currency_emoji(currency: str) -> str:
    """Get currency emoji"""
    emojis = {
        'SAR': '🇸🇦',
        'USD': '🇺🇸',
        'EUR': '🇪🇺',
        'AED': '🇦🇪',
        'EGP': '🇪🇬',
        'KWD': '🇰🇼',
        'QAR': '🇶🇦',
        'BHD': '🇧🇭',
        'OMR': '🇴🇲',
        'JOD': '🇯🇴',
        'LBP': '🇱🇧',
        'IQD': '🇮🇶',
        'SYP': '🇸🇾',
        'MAD': '🇲🇦',
        'TND': '🇹🇳',
        'DZD': '🇩🇿',
        'LYD': '🇱🇾',
        'TRY': '🇹🇷',
    }
    return emojis.get(currency, '💱')


def get_currency_symbol(currency: str) -> str:
    """Get currency symbol"""
    symbols = {
        'SAR': 'ر.س',
        'USD': '$',
        'EUR': '€',
        'AED': 'د.إ',
        'EGP': '£',
        'KWD': 'd.k',
        'QAR': 'ر.ق',
        'BHD': 'd.b',
        'OMR': 'ر.ع',
        'JOD': 'd.a',
        'LBP': 'ل.ل',
        'IQD': 'ع.د',
        'SYP': 'ل.س',
        'MAD': 'd.m',
        'TND': 'd.t',
        'DZD': 'd.j',
        'LYD': 'ل.د',
        'TRY': '₺',
    }
    return symbols.get(currency, currency)


def format_amount(amount: float, currency: str) -> str:
    """Format amount with currency"""
    emoji = get_currency_emoji(currency)
    symbol = get_currency_symbol(currency)
    return f"{emoji} {amount:,.2f} {symbol}"
