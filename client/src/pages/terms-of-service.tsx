import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsOfServicePage() {
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
              <FileText className="w-8 h-8 text-primary" />
              <CardTitle className="text-2xl">
                {language === 'ar' ? 'شروط الاستخدام' : 'Terms of Service'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            {language === 'ar' ? (
              <div className="space-y-6 text-right" dir="rtl">
                <p className="text-muted-foreground">آخر تحديث: يناير 2026</p>
                
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. قبول الشروط</h2>
                  <p>باستخدام تطبيق VEX، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يجب عليك عدم استخدام التطبيق.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. الأهلية</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>يجب أن يكون عمرك 18 عاماً على الأقل لاستخدام هذا التطبيق</li>
                    <li>يجب أن تكون لديك الأهلية القانونية للدخول في عقود ملزمة</li>
                    <li>أنت مسؤول عن ضمان أن استخدامك للتطبيق يتوافق مع القوانين المحلية</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. التسجيل والحساب</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>يجب عليك تقديم معلومات دقيقة وكاملة عند التسجيل</li>
                    <li>أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك</li>
                    <li>أنت مسؤول عن جميع الأنشطة التي تتم تحت حسابك</li>
                    <li>يُسمح بحساب واحد فقط لكل شخص</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. استخدام الخدمة</h2>
                  <p>أنت توافق على:</p>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>عدم استخدام الخدمة لأي غرض غير قانوني</li>
                    <li>عدم محاولة الوصول غير المصرح به إلى أي جزء من الخدمة</li>
                    <li>عدم التدخل في عمل الخدمة أو تعطيلها</li>
                    <li>عدم استخدام الروبوتات أو البرامج الآلية</li>
                    <li>عدم انتحال شخصية أي شخص أو كيان</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. المعاملات المالية</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>جميع المعاملات نهائية ولا يمكن التراجع عنها بمجرد تأكيدها</li>
                    <li>أنت مسؤول عن ضمان دقة تفاصيل المعاملة</li>
                    <li>قد تخضع عمليات الإيداع والسحب للتحقق</li>
                    <li>نحتفظ بالحق في رفض المعاملات المشبوهة</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. التحديات والألعاب</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>تخضع جميع التحديات لقواعد اللعبة المحددة</li>
                    <li>قرارات النظام بشأن نتائج الألعاب نهائية</li>
                    <li>يتم احتساب المكاسب والخسائر تلقائياً</li>
                    <li>نحتفظ بالحق في إلغاء التحديات المشبوهة</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. تداول P2P</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>أنت مسؤول عن معاملاتك مع المستخدمين الآخرين</li>
                    <li>توفر VEX منصة للتداول فقط ولا تضمن المعاملات</li>
                    <li>يجب الإبلاغ عن النزاعات خلال الإطار الزمني المحدد</li>
                    <li>يجب الالتزام بشروط التداول المتفق عليها</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. المحتوى وقواعد السلوك</h2>
                  <p>يُحظر:</p>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>نشر محتوى مسيء أو تمييزي أو غير قانوني</li>
                    <li>التحرش بالمستخدمين الآخرين أو تهديدهم</li>
                    <li>مشاركة معلومات كاذبة أو مضللة</li>
                    <li>الترويج لأنشطة غير قانونية</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. تعليق وإنهاء الحساب</h2>
                  <p>نحتفظ بالحق في:</p>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>تعليق أو إنهاء حسابك بسبب انتهاك الشروط</li>
                    <li>تجميد الأموال المرتبطة بنشاط مشبوه</li>
                    <li>رفض الخدمة لأي سبب</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. إخلاء المسؤولية</h2>
                  <ul className="list-disc pr-6 space-y-2">
                    <li>يتم توفير الخدمة "كما هي" دون أي ضمانات</li>
                    <li>لا نضمن توفر الخدمة بشكل متواصل</li>
                    <li>لسنا مسؤولين عن أي خسائر ناتجة عن استخدام الخدمة</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">11. التغييرات على الشروط</h2>
                  <p>قد نقوم بتحديث هذه الشروط في أي وقت. سيتم إخطارك بالتغييرات المهمة عبر التطبيق أو البريد الإلكتروني.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">12. اتصل بنا</h2>
                  <p>للأسئلة حول هذه الشروط، يرجى التواصل معنا عبر صفحة الدعم في التطبيق.</p>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-muted-foreground">Last Updated: January 2026</p>
                
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                  <p>By using the VEX app, you agree to be bound by these Terms and Conditions. If you do not agree to any part of these terms, you must not use the app.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>You must be at least 18 years old to use this app</li>
                    <li>You must have the legal capacity to enter into binding contracts</li>
                    <li>You are responsible for ensuring your use of the app complies with local laws</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. Registration and Account</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>You must provide accurate and complete information when registering</li>
                    <li>You are responsible for maintaining the confidentiality of your login credentials</li>
                    <li>You are responsible for all activities that occur under your account</li>
                    <li>Only one account per person is allowed</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. Use of Service</h2>
                  <p>You agree to:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Not use the service for any unlawful purpose</li>
                    <li>Not attempt unauthorized access to any part of the service</li>
                    <li>Not interfere with or disrupt the service</li>
                    <li>Not use bots or automated programs</li>
                    <li>Not impersonate any person or entity</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. Financial Transactions</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>All transactions are final and cannot be reversed once confirmed</li>
                    <li>You are responsible for ensuring the accuracy of transaction details</li>
                    <li>Deposits and withdrawals may be subject to verification</li>
                    <li>We reserve the right to refuse suspicious transactions</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. Challenges and Games</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>All challenges are subject to the specified game rules</li>
                    <li>System decisions regarding game outcomes are final</li>
                    <li>Winnings and losses are calculated automatically</li>
                    <li>We reserve the right to cancel suspicious challenges</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. P2P Trading</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>You are responsible for your transactions with other users</li>
                    <li>VEX provides a trading platform only and does not guarantee transactions</li>
                    <li>Disputes must be reported within the specified timeframe</li>
                    <li>You must adhere to agreed trading terms</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. Content and Conduct Rules</h2>
                  <p>Prohibited activities include:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Posting offensive, discriminatory, or illegal content</li>
                    <li>Harassing or threatening other users</li>
                    <li>Sharing false or misleading information</li>
                    <li>Promoting illegal activities</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. Account Suspension and Termination</h2>
                  <p>We reserve the right to:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Suspend or terminate your account for violating terms</li>
                    <li>Freeze funds associated with suspicious activity</li>
                    <li>Refuse service for any reason</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. Disclaimer of Warranties</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>The service is provided "as is" without any warranties</li>
                    <li>We do not guarantee continuous availability of the service</li>
                    <li>We are not liable for any losses resulting from use of the service</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">11. Changes to Terms</h2>
                  <p>We may update these terms at any time. You will be notified of significant changes via the app or email.</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
                  <p>For questions about these terms, please contact us through the Support page in the app.</p>
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
