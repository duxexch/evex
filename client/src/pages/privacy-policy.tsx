import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicyPage() {
  const { t, language } = useI18n();
  const [, setLocation] = useLocation();
  const isRtl = ['ar', 'fa', 'ur', 'he'].includes(language);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setLocation("/login")}
          className="mb-6"
          data-testid="button-back-to-login"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
          {t('common.back')}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <CardTitle className="text-2xl">
                {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            {language === 'ar' ? (
              <div className="space-y-6 text-right" dir="rtl">
                <p className="text-muted-foreground">آخر تحديث: يناير 2026</p>
                
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. مقدمة</h2>
                  <p>مرحباً بك في VEX. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح سياسة الخصوصية هذه كيف نجمع معلوماتك ونستخدمها ونحميها.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. المعلومات التي نجمعها</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li><strong>معلومات الحساب:</strong> اسم المستخدم، البريد الإلكتروني، رقم الهاتف، كلمة المرور المشفرة</li>
                    <li><strong>معلومات الملف الشخصي:</strong> الاسم المستعار، صورة الملف الشخصي</li>
                    <li><strong>بيانات المعاملات:</strong> سجل الإيداع والسحب والتحديات</li>
                    <li><strong>معلومات الجهاز:</strong> نوع الجهاز، نظام التشغيل، عنوان IP</li>
                    <li><strong>بيانات الاستخدام:</strong> كيفية تفاعلك مع تطبيقنا</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. كيف نستخدم معلوماتك</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>توفير خدماتنا وتحسينها</li>
                    <li>معالجة المعاملات والحفاظ على رصيد حسابك</li>
                    <li>إرسال إشعارات مهمة وتحديثات</li>
                    <li>منع الاحتيال وضمان أمان المنصة</li>
                    <li>الامتثال للمتطلبات القانونية</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. مشاركة المعلومات</h2>
                  <p>نحن لا نبيع معلوماتك الشخصية. قد نشارك بياناتك فقط مع:</p>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>مزودي الخدمات الذين يساعدوننا في تشغيل المنصة</li>
                    <li>السلطات القانونية عند الطلب القانوني</li>
                    <li>شركاء الدفع لمعالجة المعاملات</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. أمان البيانات</h2>
                  <p>نستخدم إجراءات أمنية متقدمة لحماية بياناتك، بما في ذلك:</p>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>تشفير البيانات أثناء النقل والتخزين</li>
                    <li>تشفير كلمات المرور باستخدام خوارزميات آمنة</li>
                    <li>مراقبة أمنية على مدار الساعة</li>
                    <li>ضوابط وصول صارمة</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. حقوقك</h2>
                  <p>لديك الحق في:</p>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>الوصول إلى بياناتك الشخصية</li>
                    <li>تصحيح المعلومات غير الدقيقة</li>
                    <li>طلب حذف حسابك</li>
                    <li>الانسحاب من الاتصالات التسويقية</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. ملفات تعريف الارتباط</h2>
                  <p>نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يمكنك التحكم في ملفات تعريف الارتباط من خلال إعدادات المتصفح.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. الاحتفاظ بالبيانات</h2>
                  <p>نحتفظ ببياناتك طالما أن حسابك نشط أو حسب الحاجة لتقديم الخدمات والامتثال للالتزامات القانونية.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. التغييرات على هذه السياسة</h2>
                  <p>قد نقوم بتحديث سياسة الخصوصية هذه. سنخطرك بأي تغييرات جوهرية عبر التطبيق أو البريد الإلكتروني.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. اتصل بنا</h2>
                  <p>إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه، يرجى التواصل معنا عبر صفحة الدعم في التطبيق.</p>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-muted-foreground">Last Updated: January 2026</p>
                
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
                  <p>Welcome to VEX. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and protect your information.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Account Information:</strong> Username, email, phone number, encrypted password</li>
                    <li><strong>Profile Information:</strong> Nickname, profile picture</li>
                    <li><strong>Transaction Data:</strong> Deposit, withdrawal, and challenge history</li>
                    <li><strong>Device Information:</strong> Device type, operating system, IP address</li>
                    <li><strong>Usage Data:</strong> How you interact with our app</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>To provide and improve our services</li>
                    <li>To process transactions and maintain your account balance</li>
                    <li>To send important notifications and updates</li>
                    <li>To prevent fraud and ensure platform security</li>
                    <li>To comply with legal requirements</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
                  <p>We do not sell your personal information. We may share your data only with:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Service providers who help us operate the platform</li>
                    <li>Legal authorities when legally required</li>
                    <li>Payment partners to process transactions</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
                  <p>We use advanced security measures to protect your data, including:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Encryption of data in transit and at rest</li>
                    <li>Password hashing using secure algorithms</li>
                    <li>24/7 security monitoring</li>
                    <li>Strict access controls</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
                  <p>You have the right to:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate information</li>
                    <li>Request account deletion</li>
                    <li>Opt-out of marketing communications</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
                  <p>We use cookies to improve your experience. You can control cookies through your browser settings.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
                  <p>We retain your data as long as your account is active or as needed to provide services and comply with legal obligations.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
                  <p>We may update this Privacy Policy. We will notify you of any material changes via the app or email.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
                  <p>If you have any questions about this Privacy Policy, please contact us through the Support page in the app.</p>
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
