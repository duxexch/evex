'use client';

import { NotificationHistoryPanel, NotificationContainer } from '@/components/notifications';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم - LangSense</h1>
          <NotificationHistoryPanel />
        </div>
      </header>

      {/* Notification container for modals and toasts */}
      <NotificationContainer />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">مرحبًا بك في نظام الإشعارات الفوري</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            هذا النظام يوفر إشعارات فورية ومتفاعلة لجميع الأحداث الحرجة المتعلقة بالوكلاء والمسوقين بالعمولة.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-blue-900 mb-2">إشعارات فورية</h3>
              <p className="text-sm text-blue-800">تسليم الإشعارات في الوقت الفعلي عبر WebSocket</p>
            </div>
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold text-green-900 mb-2">تصنيف حسب الأولوية</h3>
              <p className="text-sm text-green-800">إشعارات حرجة، عالية، متوسطة، منخفضة، ومعلوماتية</p>
            </div>
            <div className="border rounded-lg p-4 bg-purple-50">
              <h3 className="font-semibold text-purple-900 mb-2">تتبع كامل</h3>
              <p className="text-sm text-purple-800">سجل تفصيلي لجميع الإشعارات والأحداث</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
