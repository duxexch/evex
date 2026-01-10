#!/usr/bin/env python3
"""
✅ ENHANCED i18n SERVICE
Multi-language support with Arabic (RTL) and English (LTR)
Currently supporting: ar, en
"""

import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from decimal import Decimal

logger = logging.getLogger(__name__)


class I18nService:
    """خدمة الترجمة المحسّنة"""
    
    def __init__(self):
        self.translations: Dict[str, Dict[str, Any]] = {}
        self.supported_languages = {
            'ar': {'name': 'العربية', 'native': 'العربية', 'rtl': True},
            'en': {'name': 'English', 'native': 'English', 'rtl': False}
        }
        self._load_all_translations()
    
    def _load_all_translations(self):
        """تحميل جميع ملفات الترجمة"""
        translation_dir = Path(__file__).parent.parent / 'translations'
        
        for lang_code in self.supported_languages.keys():
            file_path = translation_dir / f'{lang_code}.json'
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        self.translations[lang_code] = json.load(f)
                        logger.info(f"✅ تم تحميل ترجمة: {lang_code}")
                except Exception as e:
                    logger.error(f"❌ خطأ في تحميل {lang_code}: {e}")
            else:
                logger.warning(f"⚠️  لم يتم العثور على {file_path}")
    
    def get_text(
        self,
        key: str,
        language: str = 'ar',
        **kwargs
    ) -> str:
        """
        احصل على نص مترجم مع دعم البيانات الديناميكية
        
        Args:
            key: المفتاح في ملف الترجمة (مثل "welcome")
            language: كود اللغة (ar, en)
            **kwargs: بيانات لاستبدالها في النص (مثل name="أحمد")
        
        Returns:
            النص المترجم
        """
        
        # التحقق من اللغة
        if language not in self.supported_languages:
            language = 'ar'  # الافتراضية
        
        # البحث عن النص
        if language in self.translations:
            # دعم المفاتيح المتداخلة (مثل financial.deposit)
            text = self._get_nested_value(
                self.translations[language],
                key
            )
            
            if text:
                # استبدال المتغيرات
                return self._format_text(text, **kwargs)
        
        # Fallback إلى الإنجليزية
        if language != 'en' and 'en' in self.translations:
            text = self._get_nested_value(
                self.translations['en'],
                key
            )
            if text:
                return self._format_text(text, **kwargs)
        
        # آخر محاولة - الإنجليزية
        if 'en' in self.translations:
            text = self._get_nested_value(
                self.translations['en'],
                key
            )
            if text:
                return self._format_text(text, **kwargs)
        
        # لم نجد شيء
        logger.warning(f"⚠️  لم يتم العثور على مفتاح: {key} ({language})")
        return key
    
    def get_language_info(self, language: str) -> Dict[str, Any]:
        """احصل على معلومات اللغة"""
        if language not in self.supported_languages:
            language = 'ar'
        
        return self.supported_languages[language]
    
    def is_rtl(self, language: str) -> bool:
        """هل اللغة من اليمين لليسار؟"""
        info = self.get_language_info(language)
        return info.get('rtl', False)
    
    def format_amount(
        self,
        amount: Decimal,
        currency: str,
        language: str = 'ar'
    ) -> str:
        """
        تنسيق المبلغ حسب اللغة
        
        Args:
            amount: المبلغ (Decimal)
            currency: رمز العملة (مثل SAR)
            language: اللغة
        
        Returns:
            مبلغ منسق (مثل "1,234.50 ر.س")
        """
        
        # تنسيق الرقم مع الفاصل الألفي
        formatted_amount = f"{amount:,.2f}"
        
        # رموز العملات
        currency_symbols = {
            'SAR': {'ar': 'ر.س', 'en': 'SAR'},
            'AED': {'ar': 'د.إ', 'en': 'AED'},
            'EGP': {'ar': 'ج.م', 'en': 'EGP'},
            'KWD': {'ar': 'د.ك', 'en': 'KWD'},
            'QAR': {'ar': 'ر.ق', 'en': 'QAR'},
            'BHD': {'ar': 'د.ب', 'en': 'BHD'},
            'OMR': {'ar': 'ر.ع', 'en': 'OMR'},
            'JOD': {'ar': 'د.أ', 'en': 'JOD'},
            'LBP': {'ar': 'ل.ل', 'en': 'LBP'},
            'IQD': {'ar': 'د.ع', 'en': 'IQD'},
            'SYP': {'ar': 'ل.س', 'en': 'SYP'},
            'MAD': {'ar': 'د.م', 'en': 'MAD'},
            'TND': {'ar': 'د.ت', 'en': 'TND'},
            'DZD': {'ar': 'د.ج', 'en': 'DZD'},
            'LYD': {'ar': 'د.ل', 'en': 'LYD'},
            'USD': {'ar': '$', 'en': '$'},
            'EUR': {'ar': '€', 'en': '€'},
            'TRY': {'ar': '₺', 'en': '₺'},
        }
        
        symbol = currency_symbols.get(currency, {}).get(language, currency)
        
        # ترتيب النص حسب اللغة
        if language == 'ar':
            # العربية: الرمز أولاً، ثم المبلغ (من اليمين)
            return f"{symbol} {formatted_amount}"
        else:
            # الإنجليزية: الرمز أخيراً، ثم المبلغ
            return f"{formatted_amount} {symbol}"
    
    def format_date(
        self,
        date,
        language: str = 'ar',
        format_type: str = 'short'  # short, long, time
    ) -> str:
        """
        تنسيق التاريخ حسب اللغة
        
        Args:
            date: كائن datetime
            language: اللغة
            format_type: نوع التنسيق
        
        Returns:
            تاريخ منسق
        """
        from datetime import datetime
        
        if not isinstance(date, datetime):
            return str(date)
        
        if language == 'ar':
            # أسماء الأشهر بالعربية
            months_ar = [
                'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
            ]
            
            # أسماء الأيام بالعربية
            weekdays_ar = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
            
            month_name = months_ar[date.month - 1]
            weekday_name = weekdays_ar[date.weekday()]
            
            if format_type == 'short':
                return f"{date.day} {month_name} {date.year}"
            elif format_type == 'long':
                return f"{weekday_name} {date.day} {month_name} {date.year}"
            elif format_type == 'time':
                return f"{date.strftime('%H:%M')} {date.day} {month_name}"
        else:
            # الإنجليزية
            if format_type == 'short':
                return date.strftime('%b %d, %Y')
            elif format_type == 'long':
                return date.strftime('%A, %B %d, %Y')
            elif format_type == 'time':
                return date.strftime('%H:%M %b %d')
        
        return date.isoformat()
    
    def get_pluralized_text(
        self,
        count: int,
        singular_key: str,
        plural_key: str,
        language: str = 'ar',
        **kwargs
    ) -> str:
        """
        احصل على نص مجموع أو مفرد حسب العدد
        
        Args:
            count: العدد
            singular_key: مفتاح النص المفرد
            plural_key: مفتاح النص الجمع
            language: اللغة
            **kwargs: بيانات إضافية
        
        Returns:
            النص المناسب
        """
        
        if count == 1:
            return self.get_text(singular_key, language, count=count, **kwargs)
        else:
            return self.get_text(plural_key, language, count=count, **kwargs)
    
    def _get_nested_value(
        self,
        data: Dict,
        key: str
    ) -> Optional[str]:
        """احصل على قيمة متداخلة باستخدام نقطة (مثل financial.deposit)"""
        keys = key.split('.')
        current = data
        
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            else:
                return None
        
        return current if isinstance(current, str) else None
    
    def _format_text(self, text: str, **kwargs) -> str:
        """استبدل المتغيرات في النص"""
        try:
            return text.format(**kwargs)
        except KeyError as e:
            logger.warning(f"⚠️  متغير غير موجود في النص: {e}")
            return text
        except Exception as e:
            logger.error(f"❌ خطأ في تنسيق النص: {e}")
            return text


# إنشاء instance واحد للخدمة
_i18n_service = None

def get_i18n_service() -> I18nService:
    """احصل على instance خدمة الترجمة"""
    global _i18n_service
    
    if _i18n_service is None:
        _i18n_service = I18nService()
    
    return _i18n_service
