#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy Service Wrapper
======================
Wraps comprehensive_bot.py functionality for integration with aiogram-based main.py

This module provides async-safe access to legacy CSV-based features:
- Deposit/Withdrawal system
- User management
- Transaction tracking
- Admin dashboard
- Multi-currency support

All functions are thread-safe and compatible with aiogram's async architecture.
"""

import asyncio
import csv
import os
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any
from functools import wraps
import logging

logger = logging.getLogger(__name__)

# Thread lock for CSV file operations
csv_lock = threading.Lock()

# Admin balance protection
PROTECTED_ADMIN_BALANCE = 10_000_000_000  # 10 billion SAR
PROTECTED_ADMIN_ID = 7146701713  # Mohand


def async_csv_operation(func):
    """Decorator to make CSV operations async-safe"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))
    return wrapper


def thread_safe_csv(func):
    """Decorator for thread-safe CSV operations"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        with csv_lock:
            return func(*args, **kwargs)
    return wrapper


class LegacyService:
    """
    Wrapper for comprehensive_bot.py legacy features
    
    Provides async-compatible access to:
    - User registration and management
    - Deposit/Withdrawal transactions
    - Company and payment method management
    - Multi-currency system
    - Admin dashboard functions
    """
    
    def __init__(self):
        """Initialize legacy service"""
        self.currencies = {
            'SAR': {'name': 'الريال السعودي', 'symbol': 'ر.س', 'flag': '🇸🇦'},
            'AED': {'name': 'الدرهم الإماراتي', 'symbol': 'د.إ', 'flag': '🇦🇪'},
            'EGP': {'name': 'الجنيه المصري', 'symbol': 'ج.م', 'flag': '🇪🇬'},
            'KWD': {'name': 'الدينار الكويتي', 'symbol': 'د.ك', 'flag': '🇰🇼'},
            'QAR': {'name': 'الريال القطري', 'symbol': 'ر.ق', 'flag': '🇶🇦'},
            'BHD': {'name': 'الدينار البحريني', 'symbol': 'د.ب', 'flag': '🇧🇭'},
            'OMR': {'name': 'الريال العماني', 'symbol': 'ر.ع', 'flag': '🇴🇲'},
            'JOD': {'name': 'الدينار الأردني', 'symbol': 'د.أ', 'flag': '🇯🇴'},
            'LBP': {'name': 'الليرة اللبنانية', 'symbol': 'ل.ل', 'flag': '🇱🇧'},
            'IQD': {'name': 'الدينار العراقي', 'symbol': 'د.ع', 'flag': '🇮🇶'},
            'SYP': {'name': 'الليرة السورية', 'symbol': 'ل.س', 'flag': '🇸🇾'},
            'MAD': {'name': 'الدرهم المغربي', 'symbol': 'د.م', 'flag': '🇲🇦'},
            'TND': {'name': 'الدينار التونسي', 'symbol': 'د.ت', 'flag': '🇹🇳'},
            'DZD': {'name': 'الدينار الجزائري', 'symbol': 'د.ج', 'flag': '🇩🇿'},
            'LYD': {'name': 'الدينار الليبي', 'symbol': 'د.ل', 'flag': '🇱🇾'},
            'USD': {'name': 'الدولار الأمريكي', 'symbol': '$', 'flag': '🇺🇸'},
            'EUR': {'name': 'اليورو', 'symbol': '€', 'flag': '🇪🇺'},
            'TRY': {'name': 'الليرة التركية', 'symbol': '₺', 'flag': '🇹🇷'}
        }
        self._ensure_csv_files()
        logger.info("Legacy service initialized")
    
    @thread_safe_csv
    def _ensure_csv_files(self):
        """Ensure all CSV files exist with proper headers"""
        
        # users.csv
        if not os.path.exists('users.csv'):
            with open('users.csv', 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['telegram_id', 'name', 'phone', 'customer_id', 'language', 'date', 'is_banned', 'ban_reason', 'currency'])
        
        # transactions.csv
        if not os.path.exists('transactions.csv'):
            with open('transactions.csv', 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'customer_id', 'telegram_id', 'name', 'type', 'company', 'wallet_number', 'amount', 'exchange_address', 'status', 'date', 'admin_note', 'processed_by'])
        
        # companies.csv
        if not os.path.exists('companies.csv'):
            with open('companies.csv', 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'name', 'type', 'details', 'is_active'])
                companies = [
                    ['1', 'STC Pay', 'both', 'محفظة إلكترونية', 'active'],
                    ['2', 'البنك الأهلي', 'deposit', 'حساب بنكي رقم: 1234567890', 'active'],
                    ['3', 'فودافون كاش', 'both', 'محفظة إلكترونية', 'active'],
                    ['4', 'بنك الراجحي', 'deposit', 'حساب بنكي رقم: 0987654321', 'active'],
                    ['5', 'مدى البنك الأهلي', 'withdraw', 'رقم الحساب للسحب', 'active']
                ]
                for company in companies:
                    writer.writerow(company)
        
        # exchange_addresses.csv
        if not os.path.exists('exchange_addresses.csv'):
            with open('exchange_addresses.csv', 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'address', 'is_active'])
                writer.writerow(['1', 'شارع الملك فهد، الرياض، مقابل مول الرياض - الدور الأول', 'yes'])
        
        # complaints.csv
        if not os.path.exists('complaints.csv'):
            with open('complaints.csv', 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['id', 'customer_id', 'message', 'status', 'date', 'admin_response'])
        
        # system_settings.csv
        if not os.path.exists('system_settings.csv'):
            with open('system_settings.csv', 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['setting_key', 'setting_value', 'description'])
                settings = [
                    ['min_deposit', '50', 'أقل مبلغ إيداع'],
                    ['min_withdrawal', '100', 'أقل مبلغ سحب'],
                    ['max_daily_withdrawal', '10000', 'أقصى سحب يومي'],
                    ['support_phone', '+966501234567', 'رقم الدعم'],
                    ['company_name', 'DUX', 'اسم الشركة'],
                    ['default_currency', 'SAR', 'العملة الافتراضية']
                ]
                for setting in settings:
                    writer.writerow(setting)
    
    # ==================== USER MANAGEMENT ====================
    
    @thread_safe_csv
    def find_user(self, telegram_id: int) -> Optional[Dict[str, str]]:
        """Find user by telegram ID"""
        try:
            with open('users.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['telegram_id'] == str(telegram_id):
                        return row
        except Exception as e:
            logger.error(f"Error finding user: {e}")
        return None
    
    @async_csv_operation
    @thread_safe_csv
    def create_user(self, telegram_id: int, name: str, phone: str, language: str = 'ar', currency: str = 'SAR') -> str:
        """Create new user and return customer_id"""
        customer_id = f"C{str(int(datetime.now().timestamp()))[-6:]}"
        date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        with open('users.csv', 'a', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([telegram_id, name, phone, customer_id, language, date, 'no', '', currency])
        
        logger.info(f"Created user: {customer_id} ({name})")
        return customer_id
    
    @async_csv_operation
    @thread_safe_csv
    def update_user_currency(self, telegram_id: int, currency: str) -> bool:
        """Update user's preferred currency"""
        try:
            rows = []
            updated = False
            
            with open('users.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                
                for row in reader:
                    if row['telegram_id'] == str(telegram_id):
                        row['currency'] = currency
                        updated = True
                    rows.append(row)
            
            if updated:
                with open('users.csv', 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                logger.info(f"Updated currency for user {telegram_id} to {currency}")
            
            return updated
        except Exception as e:
            logger.error(f"Error updating currency: {e}")
            return False
    
    @async_csv_operation
    @thread_safe_csv
    def get_user_balance(self, telegram_id: int) -> float:
        """
        Get user wallet balance
        
        Admin balance protection: User 7146701713 always has 10B SAR
        """
        if telegram_id == PROTECTED_ADMIN_ID:
            return PROTECTED_ADMIN_BALANCE
        
        # For other users, read from wallets.csv
        try:
            if not os.path.exists('wallets.csv'):
                return 0.0
            
            with open('wallets.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['telegram_id'] == str(telegram_id):
                        return float(row.get('balance', 0))
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
        
        return 0.0
    
    # ==================== TRANSACTION MANAGEMENT ====================
    
    @async_csv_operation
    @thread_safe_csv
    def create_deposit(self, telegram_id: int, amount: float, company: str, wallet_number: str) -> str:
        """Create deposit request"""
        user = self.find_user(telegram_id)
        if not user:
            raise ValueError("User not found")
        
        trans_id = f"DEP{str(int(datetime.now().timestamp()))[-6:]}"
        date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        with open('transactions.csv', 'a', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                trans_id,
                user['customer_id'],
                telegram_id,
                user['name'],
                'deposit',
                company,
                wallet_number,
                amount,
                '',  # exchange_address
                'pending',
                date,
                '',  # admin_note
                ''   # processed_by
            ])
        
        logger.info(f"Created deposit: {trans_id} for {amount} via {company}")
        return trans_id
    
    @async_csv_operation
    @thread_safe_csv
    def create_withdrawal(self, telegram_id: int, amount: float, exchange_address: str) -> str:
        """Create withdrawal request"""
        user = self.find_user(telegram_id)
        if not user:
            raise ValueError("User not found")
        
        trans_id = f"WITH{str(int(datetime.now().timestamp()))[-6:]}"
        date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        with open('transactions.csv', 'a', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                trans_id,
                user['customer_id'],
                telegram_id,
                user['name'],
                'withdrawal',
                '',  # company
                '',  # wallet_number
                amount,
                exchange_address,
                'pending',
                date,
                '',  # admin_note
                ''   # processed_by
            ])
        
        logger.info(f"Created withdrawal: {trans_id} for {amount}")
        return trans_id
    
    @async_csv_operation
    @thread_safe_csv
    def get_user_transactions(self, telegram_id: int, status: Optional[str] = None) -> List[Dict[str, str]]:
        """Get user transactions, optionally filtered by status"""
        transactions = []
        
        try:
            with open('transactions.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['telegram_id'] == str(telegram_id):
                        if status is None or row['status'] == status:
                            transactions.append(row)
        except Exception as e:
            logger.error(f"Error getting transactions: {e}")
        
        return transactions
    
    @async_csv_operation
    @thread_safe_csv
    def get_pending_transactions(self) -> List[Dict[str, str]]:
        """Get all pending transactions for admin review"""
        transactions = []
        
        try:
            with open('transactions.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['status'] == 'pending':
                        transactions.append(row)
        except Exception as e:
            logger.error(f"Error getting pending transactions: {e}")
        
        return transactions
    
    @async_csv_operation
    @thread_safe_csv
    def approve_transaction(self, trans_id: str, admin_id: int, note: str = '') -> bool:
        """Approve a transaction"""
        try:
            rows = []
            approved = False
            
            with open('transactions.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                
                for row in reader:
                    if row['id'] == trans_id and row['status'] == 'pending':
                        row['status'] = 'approved'
                        row['admin_note'] = note
                        row['processed_by'] = str(admin_id)
                        approved = True
                    rows.append(row)
            
            if approved:
                with open('transactions.csv', 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                logger.info(f"Approved transaction {trans_id} by admin {admin_id}")
            
            return approved
        except Exception as e:
            logger.error(f"Error approving transaction: {e}")
            return False
    
    @async_csv_operation
    @thread_safe_csv
    def reject_transaction(self, trans_id: str, admin_id: int, note: str = '') -> bool:
        """Reject a transaction"""
        try:
            rows = []
            rejected = False
            
            with open('transactions.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                
                for row in reader:
                    if row['id'] == trans_id and row['status'] == 'pending':
                        row['status'] = 'rejected'
                        row['admin_note'] = note
                        row['processed_by'] = str(admin_id)
                        rejected = True
                    rows.append(row)
            
            if rejected:
                with open('transactions.csv', 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                logger.info(f"Rejected transaction {trans_id} by admin {admin_id}")
            
            return rejected
        except Exception as e:
            logger.error(f"Error rejecting transaction: {e}")
            return False
    
    # ==================== COMPANY MANAGEMENT ====================
    
    @thread_safe_csv
    def get_companies(self, service_type: Optional[str] = None) -> List[Dict[str, str]]:
        """Get active companies, optionally filtered by service type (deposit/withdraw/both)"""
        companies = []
        
        try:
            with open('companies.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('is_active', '').lower() in ['active', 'yes', '1', 'true']:
                        if service_type is None:
                            companies.append(row)
                        elif row['type'] == service_type or row['type'] == 'both':
                            companies.append(row)
        except Exception as e:
            logger.error(f"Error getting companies: {e}")
        
        return companies
    
    @thread_safe_csv
    def add_company(self, name: str, service_type: str, details: str = '') -> str:
        """Add new company"""
        try:
            # Get max ID
            max_id = 0
            with open('companies.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        max_id = max(max_id, int(row['id']))
                    except:
                        pass
            
            new_id = str(max_id + 1)
            
            with open('companies.csv', 'a', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow([new_id, name, service_type, details, 'active'])
            
            logger.info(f"Added company: {name} (ID: {new_id})")
            return new_id
        except Exception as e:
            logger.error(f"Error adding company: {e}")
            raise
    
    @thread_safe_csv
    def get_payment_methods_by_company(self, company_id: str) -> List[Dict[str, str]]:
        """Get active payment methods for a specific company"""
        methods = []
        
        try:
            with open('payment_methods.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if (row.get('company_id') == str(company_id) and 
                        row.get('status', '').lower() in ['active', 'yes', '1', 'true']):
                        methods.append(row)
        except Exception as e:
            logger.error(f"Error getting payment methods for company {company_id}: {e}")
        
        return methods
    
    # ==================== SYSTEM SETTINGS ====================
    
    @async_csv_operation
    @thread_safe_csv
    def get_setting(self, key: str) -> Optional[str]:
        """Get system setting"""
        try:
            with open('system_settings.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['setting_key'] == key:
                        return row['setting_value']
        except Exception as e:
            logger.error(f"Error getting setting: {e}")
        return None
    
    @async_csv_operation
    @thread_safe_csv
    def update_setting(self, key: str, value: str) -> bool:
        """Update system setting"""
        try:
            rows = []
            updated = False
            
            with open('system_settings.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                
                for row in reader:
                    if row['setting_key'] == key:
                        row['setting_value'] = value
                        updated = True
                    rows.append(row)
            
            if updated:
                with open('system_settings.csv', 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                logger.info(f"Updated setting {key} = {value}")
            
            return updated
        except Exception as e:
            logger.error(f"Error updating setting: {e}")
            return False
    
    # ==================== CURRENCY SYSTEM ====================
    
    def get_currency_info(self, currency_code: str) -> Optional[Dict[str, str]]:
        """Get currency information"""
        return self.currencies.get(currency_code.upper())
    
    def format_amount(self, amount: float, currency_code: str) -> str:
        """Format amount with currency"""
        currency = self.get_currency_info(currency_code)
        if currency:
            return f"{currency['flag']} {amount:,.2f} {currency['symbol']}"
        return f"{amount:,.2f}"
    
    def get_available_currencies(self) -> List[Dict[str, Any]]:
        """Get list of all available currencies"""
        return [
            {'code': code, **info}
            for code, info in self.currencies.items()
        ]
    
    # ==================== ADMIN DASHBOARD ====================
    
    @async_csv_operation
    @thread_safe_csv
    def get_statistics(self) -> Dict[str, Any]:
        """Get system statistics for admin dashboard"""
        stats = {
            'total_users': 0,
            'active_users': 0,
            'banned_users': 0,
            'total_transactions': 0,
            'pending_transactions': 0,
            'approved_transactions': 0,
            'rejected_transactions': 0,
            'total_deposits': 0,
            'total_withdrawals': 0,
            'deposit_amount': 0.0,
            'withdrawal_amount': 0.0
        }
        
        try:
            # Count users
            with open('users.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    stats['total_users'] += 1
                    if row.get('is_banned') == 'yes':
                        stats['banned_users'] += 1
                    else:
                        stats['active_users'] += 1
            
            # Count transactions
            with open('transactions.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    stats['total_transactions'] += 1
                    
                    status = row['status']
                    if status == 'pending':
                        stats['pending_transactions'] += 1
                    elif status == 'approved':
                        stats['approved_transactions'] += 1
                    elif status == 'rejected':
                        stats['rejected_transactions'] += 1
                    
                    trans_type = row['type']
                    amount = float(row.get('amount', 0))
                    
                    if trans_type == 'deposit':
                        stats['total_deposits'] += 1
                        if status == 'approved':
                            stats['deposit_amount'] += amount
                    elif trans_type == 'withdrawal':
                        stats['total_withdrawals'] += 1
                        if status == 'approved':
                            stats['withdrawal_amount'] += amount
        
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
        
        return stats
    
    # ==================== COMPLAINTS ====================
    
    @async_csv_operation
    @thread_safe_csv
    def create_complaint(self, telegram_id: int, message: str) -> str:
        """Create new complaint"""
        user = self.find_user(telegram_id)
        if not user:
            raise ValueError("User not found")
        
        complaint_id = f"COMP{str(int(datetime.now().timestamp()))[-6:]}"
        date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        with open('complaints.csv', 'a', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([complaint_id, user['customer_id'], message, 'pending', date, ''])
        
        logger.info(f"Created complaint: {complaint_id}")
        return complaint_id
    
    @async_csv_operation
    @thread_safe_csv
    def get_pending_complaints(self) -> List[Dict[str, str]]:
        """Get all pending complaints"""
        complaints = []
        
        try:
            with open('complaints.csv', 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['status'] == 'pending':
                        complaints.append(row)
        except Exception as e:
            logger.error(f"Error getting complaints: {e}")
        
        return complaints


# Global instance
legacy_service = LegacyService()
