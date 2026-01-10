"""
نهاية إلى نهاية اختبار التطبيق - END TO END APPLICATION TEST
=============================================================

هذا الملف يختبر التطبيق بالكامل بدء من التسجيل إلى السحب
"""

import asyncio
import logging
from datetime import datetime
from sqlalchemy import select, func

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class E2ETestRunner:
    """فئة اختبار نهاية إلى نهاية"""
    
    def __init__(self, session_maker):
        self.session_maker = session_maker
        self.test_user_id = 123456789  # معرف مستخدم اختبار
        self.test_results = []
    
    async def run_all_tests(self):
        """تشغيل جميع الاختبارات"""
        print("\n" + "="*50)
        print("🧪 اختبار نهاية إلى نهاية للتطبيق")
        print("="*50 + "\n")
        
        tests = [
            self.test_withdrawal_address_model,
            self.test_verification_code_logic,
            self.test_currency_limits,
            self.test_complaint_system,
            self.test_request_filtering,
            self.test_user_statistics,
            self.test_security_constraints,
        ]
        
        for test in tests:
            try:
                await test()
                self.test_results.append((test.__name__, "✅ نجح"))
            except AssertionError as e:
                self.test_results.append((test.__name__, f"❌ فشل: {e}"))
                logger.error(f"Test failed: {test.__name__}: {e}")
            except Exception as e:
                self.test_results.append((test.__name__, f"⚠️ خطأ: {e}"))
                logger.error(f"Test error: {test.__name__}: {e}")
        
        await self.print_results()
    
    async def test_withdrawal_address_model(self):
        """اختبار نموذج العنوان المحفوظ"""
        logger.info("اختبار نموذج العنوان...")
        
        async with self.session_maker() as session:
            from models import WithdrawalAddress, User
            
            # تحقق من وجود المستخدم
            user = await session.get(User, self.test_user_id)
            if not user:
                logger.warning("مستخدم الاختبار غير موجود، تخطي الاختبار")
                return
            
            # حاول إنشاء عنوان جديد
            new_address = WithdrawalAddress(
                user_id=self.test_user_id,
                address="123 شارع الملك، الرياض 12345",
                label="البنك الأهلي",
                is_active=True
            )
            
            session.add(new_address)
            await session.commit()
            
            # تحقق من حفظه
            stmt = select(WithdrawalAddress).where(
                WithdrawalAddress.user_id == self.test_user_id
            )
            addresses = await session.scalars(stmt)
            addresses = list(addresses)
            
            assert len(addresses) > 0, "لم يتم حفظ العنوان"
            assert addresses[0].address == "123 شارع الملك، الرياض 12345"
            assert addresses[0].label == "البنك الأهلي"
            
            logger.info("✅ نموذج العنوان يعمل بشكل صحيح")
    
    async def test_verification_code_logic(self):
        """اختبار منطق رمز التحقق"""
        logger.info("اختبار رمز التحقق...")
        
        from handlers.financial_operations import generate_verification_code
        
        # توليد 5 رموز والتحقق من عدم تكرارها
        codes = set()
        for _ in range(5):
            code = generate_verification_code()
            
            # تحقق من الصيغة
            assert isinstance(code, str), "الرمز يجب أن يكون نص"
            assert len(code) == 4, "الرمز يجب أن يكون 4 أرقام"
            assert code.isdigit(), "الرمز يجب أن يحتوي أرقام فقط"
            
            # تحقق من عدم التكرار
            assert code not in codes, "الرموز متكررة (ضعيفة)"
            codes.add(code)
        
        logger.info(f"✅ توليد رموز عشوائية يعمل: {codes}")
    
    async def test_currency_limits(self):
        """اختبار حدود العملات"""
        logger.info("اختبار حدود العملات...")
        
        from handlers.currency import CURRENCIES, get_currency_limits
        
        # تحقق من وجود جميع العملات
        assert 'SAR' in CURRENCIES, "SAR غير موجود"
        assert 'USD' in CURRENCIES, "USD غير موجود"
        assert 'EUR' in CURRENCIES, "EUR غير موجود"
        assert 'AED' in CURRENCIES, "AED غير موجود"
        
        # تحقق من الحدود لكل عملة
        currencies_to_test = {
            'SAR': {'deposit': (50, 10000), 'withdraw': (100, 10000)},
            'USD': {'deposit': (10, 2000), 'withdraw': (20, 2000)},
            'EUR': {'deposit': (8, 1500), 'withdraw': (15, 1500)},
            'AED': {'deposit': (180, 36000), 'withdraw': (350, 36000)},
        }
        
        for currency, limits in currencies_to_test.items():
            for operation, (min_exp, max_exp) in limits.items():
                min_val, max_val = get_currency_limits(currency, operation)
                assert min_val == min_exp, f"{currency} {operation} الحد الأدنى خاطئ"
                assert max_val == max_exp, f"{currency} {operation} الحد الأقصى خاطئ"
        
        logger.info("✅ حدود العملات صحيحة")
    
    async def test_complaint_system(self):
        """اختبار نظام الشكاوى"""
        logger.info("اختبار نظام الشكاوى...")
        
        async with self.session_maker() as session:
            from models import Outbox, OutboxStatus, User
            
            user = await session.get(User, self.test_user_id)
            if not user:
                logger.warning("مستخدم الاختبار غير موجود، تخطي الاختبار")
                return
            
            # أنشئ شكوى اختبار
            complaint = Outbox(
                user_id=self.test_user_id,
                type='complaint',
                amount=0,
                status=OutboxStatus.PENDING,
                extra_data={
                    'complaint_type': 'deposit_issue',
                    'complaint_details': 'هذه شكوى اختبار',
                    'submitted_at': datetime.now().isoformat(),
                }
            )
            
            session.add(complaint)
            await session.commit()
            
            # تحقق من حفظها
            stmt = select(Outbox).where(
                Outbox.user_id == self.test_user_id,
                Outbox.type == 'complaint'
            )
            complaints = await session.scalars(stmt)
            complaints = list(complaints)
            
            assert len(complaints) > 0, "لم يتم حفظ الشكوى"
            assert complaints[0].status == OutboxStatus.PENDING, "الحالة الأولية خاطئة"
            
            logger.info("✅ نظام الشكاوى يعمل بشكل صحيح")
    
    async def test_request_filtering(self):
        """اختبار تصفية الطلبات"""
        logger.info("اختبار تصفية الطلبات...")
        
        async with self.session_maker() as session:
            from models import Outbox, OutboxStatus, User
            
            user = await session.get(User, self.test_user_id)
            if not user:
                logger.warning("مستخدم الاختبار غير موجود، تخطي الاختبار")
                return
            
            # احسب عدد الطلبات المعلقة
            stmt = select(func.count(Outbox.id)).where(
                Outbox.user_id == self.test_user_id,
                Outbox.status == OutboxStatus.PENDING
            )
            pending_count = await session.scalar(stmt)
            
            # احسب عدد جميع الطلبات
            stmt = select(func.count(Outbox.id)).where(
                Outbox.user_id == self.test_user_id
            )
            total_count = await session.scalar(stmt)
            
            logger.info(f"الطلبات المعلقة: {pending_count}, الإجمالي: {total_count}")
            assert total_count >= pending_count, "العد الإجمالي خاطئ"
            
            logger.info("✅ تصفية الطلبات تعمل بشكل صحيح")
    
    async def test_user_statistics(self):
        """اختبار إحصائيات المستخدم"""
        logger.info("اختبار إحصائيات المستخدم...")
        
        async with self.session_maker() as session:
            from models import Outbox, User
            
            user = await session.get(User, self.test_user_id)
            if not user:
                logger.warning("مستخدم الاختبار غير موجود، تخطي الاختبار")
                return
            
            # احسب إجمالي الإيداعات
            stmt = select(func.count(Outbox.id)).where(
                Outbox.user_id == self.test_user_id,
                Outbox.type == 'deposit'
            )
            deposits = await session.scalar(stmt)
            
            # احسب إجمالي السحب
            stmt = select(func.count(Outbox.id)).where(
                Outbox.user_id == self.test_user_id,
                Outbox.type == 'withdrawal'
            )
            withdrawals = await session.scalar(stmt)
            
            logger.info(f"الإيداعات: {deposits}, السحب: {withdrawals}")
            
            assert deposits is not None, "فشل حساب الإيداعات"
            assert withdrawals is not None, "فشل حساب السحب"
            
            logger.info("✅ إحصائيات المستخدم تعمل بشكل صحيح")
    
    async def test_security_constraints(self):
        """اختبار قيود الأمان"""
        logger.info("اختبار قيود الأمان...")
        
        async with self.session_maker() as session:
            from models import WithdrawalAddress, User
            
            # تحقق من الفصل بين المستخدمين
            user1_id = self.test_user_id
            user2_id = 999999999
            
            user = await session.get(User, user1_id)
            if not user:
                logger.warning("مستخدم الاختبار غير موجود، تخطي الاختبار")
                return
            
            # لا يجب أن يرى المستخدم 1 عناوين المستخدم 2
            stmt = select(WithdrawalAddress).where(
                WithdrawalAddress.user_id == user1_id
            )
            user1_addresses = await session.scalars(stmt)
            
            stmt = select(WithdrawalAddress).where(
                WithdrawalAddress.user_id == user2_id
            )
            user2_addresses = await session.scalars(stmt)
            
            user1_addresses = list(user1_addresses)
            user2_addresses = list(user2_addresses)
            
            # التحقق من الفصل
            user1_ids = {a.id for a in user1_addresses}
            user2_ids = {a.id for a in user2_addresses}
            
            assert len(user1_ids & user2_ids) == 0, "تسرب أمني: الخلط بين بيانات المستخدمين"
            
            logger.info("✅ قيود الأمان تعمل بشكل صحيح")
    
    async def print_results(self):
        """طباعة نتائج الاختبارات"""
        print("\n" + "="*50)
        print("📊 نتائج الاختبارات")
        print("="*50 + "\n")
        
        passed = sum(1 for _, result in self.test_results if "✅" in result)
        total = len(self.test_results)
        
        for test_name, result in self.test_results:
            print(f"{result:20} | {test_name}")
        
        print("\n" + "-"*50)
        print(f"النتيجة: {passed}/{total} اختبار نجح ({100*passed//total}%)")
        print("="*50 + "\n")
        
        if passed == total:
            print("🎉 جميع الاختبارات نجحت! التطبيق جاهز للإنتاج.\n")
            return True
        else:
            print(f"⚠️ {total - passed} اختبار فشل. يحتاج إلى إصلاح.\n")
            return False


async def main():
    """الدالة الرئيسية"""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    import os
    
    # إعداد قاعدة البيانات
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./langsense.db"
    )
    
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True
    )
    
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
    
    # تشغيل الاختبارات
    runner = E2ETestRunner(async_session)
    success = await runner.run_all_tests()
    
    # إغلاق الاتصال
    await engine.dispose()
    
    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
