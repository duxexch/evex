export default {
  ar: {
    // Welcome & Auth
    welcome: 'مرحباً بك في DUX 👋',
    welcome_back: 'مرحباً بك مجدداً!',
    login: 'تسجيل الدخول',
    register: 'التسجيل',
    logout: 'تسجيل الخروج',
    forgot_password: 'هل نسيت كلمة المرور؟',

    // Auth Form
    phone: 'رقم الهاتف',
    password: 'كلمة المرور',
    confirm_password: 'تأكيد كلمة المرور',
    first_name: 'الاسم الأول',
    last_name: 'الاسم الأخير',
    language: 'اللغة',
    country: 'الدولة',

    // Errors
    error: {
      invalid_phone: 'رقم هاتف غير صحيح',
      invalid_password: 'كلمة مرور غير صحيحة',
      invalid_email: 'بريد إلكتروني غير صحيح',
      password_mismatch: 'كلمات المرور غير متطابقة',
      user_not_found: 'المستخدم غير موجود',
      unauthorized: 'غير مصرح',
      network_error: 'خطأ في الاتصال',
      timeout: 'انتهت مهلة الانتظار',
      server_error: 'خطأ في الخادم',
      invalid_amount: 'مبلغ غير صحيح',
      insufficient_balance: 'رصيد غير كافي',
      min_deposit: 'الحد الأدنى للإيداع: {amount}',
      max_deposit: 'الحد الأقصى للإيداع: {amount}',
    },

    // Menu
    menu: {
      home: 'الرئيسية',
      balance: '💰 الرصيد',
      deposit: '💳 إيداع',
      withdraw: '💸 سحب',
      transactions: '📋 المعاملات',
      profile: '👤 الملف الشخصي',
      settings: '⚙️ الإعدادات',
      support: '📞 الدعم',
      logout: 'تسجيل الخروج',
    },

    // Home Screen
    home: {
      title: 'الرئيسية',
      hello: 'مرحباً {name}!',
      current_balance: 'الرصيد الحالي',
      quick_actions: 'الإجراءات السريعة',
      recent_transactions: 'آخر المعاملات',
      no_transactions: 'لا توجد معاملات',
    },

    // Balance Screen
    balance: {
      title: 'الرصيد',
      current: 'الرصيد الحالي',
      total_deposited: 'إجمالي الإيداعات',
      total_withdrawn: 'إجمالي السحوبات',
      daily_limit: 'الحد اليومي المتبقي',
      last_updated: 'آخر تحديث: {time}',
    },

    // Deposit Screen
    deposit: {
      title: 'إيداع',
      enter_amount: 'أدخل المبلغ',
      select_method: 'اختر طريقة الدفع',
      bank_transfer: '🏦 تحويل بنكي',
      card: '💳 بطاقة ائتمان',
      wallet: '📱 محفظة رقمية',
      confirm_deposit: 'تأكيد الإيداع',
      amount: 'المبلغ',
      method: 'الطريقة',
      deposit_submitted: 'تم إرسال طلب الإيداع',
      wait_approval: 'يرجى الانتظار لتأكيد الطلب',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
    },

    // Withdraw Screen
    withdraw: {
      title: 'سحب',
      enter_amount: 'أدخل المبلغ',
      select_method: 'اختر طريقة الاستقبال',
      bank_account: '🏦 حساب بنكي',
      wallet: '📱 محفظة رقمية',
      confirm_withdraw: 'تأكيد السحب',
      bank_name: 'اسم البنك',
      account_number: 'رقم الحساب',
      iban: 'IBAN',
      wallet_address: 'عنوان المحفظة',
      withdraw_submitted: 'تم إرسال طلب السحب',
      wait_approval: 'يرجى الانتظار لتأكيد الطلب',
    },

    // Transactions Screen
    transactions: {
      title: 'المعاملات',
      no_transactions: 'لا توجد معاملات',
      deposit: 'إيداع',
      withdrawal: 'سحب',
      transfer: 'تحويل',
      commission: 'عمولة',
      date: 'التاريخ',
      amount: 'المبلغ',
      status: 'الحالة',
      pending: 'قيد الانتظار',
      completed: 'مكتمل',
      failed: 'فشل',
      cancelled: 'ملغى',
    },

    // Profile Screen
    profile: {
      title: 'الملف الشخصي',
      name: 'الاسم',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      member_since: 'عضو منذ {date}',
      verify_account: 'تحقق من الحساب',
      change_password: 'غير كلمة المرور',
      delete_account: 'حذف الحساب',
    },

    // Settings Screen
    settings: {
      title: 'الإعدادات',
      language: 'اللغة',
      currency: 'العملة',
      notifications: 'التنبيهات',
      push_notifications: 'إشعارات الدفع',
      email_notifications: 'إشعارات البريد الإلكتروني',
      sms_notifications: 'إشعارات SMS',
      security: 'الأمان',
      two_factor_auth: 'المصادقة الثنائية',
      privacy: 'الخصوصية',
      about: 'حول التطبيق',
      version: 'الإصدار {version}',
    },

    // Support Screen
    support: {
      title: 'الدعم',
      category: 'الفئة',
      subject: 'الموضوع',
      message: 'الرسالة',
      send: 'إرسال',
      tickets: 'التذاكر',
      create_ticket: 'إنشاء تذكرة دعم',
      ticket_created: 'تم إنشاء التذكرة بنجاح',
      no_tickets: 'لا توجد تذاكر دعم',
      status: 'الحالة',
      open: 'مفتوح',
      closed: 'مغلق',
      in_progress: 'قيد المعالجة',
    },

    // General
    loading: 'جاري التحميل...',
    retry: 'إعادة محاولة',
    ok: 'حسناً',
    cancel: 'إلغاء',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    close: 'إغلاق',
    search: 'بحث',
    filter: 'تصفية',
    sort: 'فرز',
    no_data: 'لا توجد بيانات',
    try_again: 'حاول مجدداً',
    success: 'نجاح',
    failed: 'فشل',
    warning: 'تحذير',
  },

  en: {
    // Welcome & Auth
    welcome: 'Welcome to DUX 👋',
    welcome_back: 'Welcome back!',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    forgot_password: 'Forgot password?',

    // Auth Form
    phone: 'Phone Number',
    password: 'Password',
    confirm_password: 'Confirm Password',
    first_name: 'First Name',
    last_name: 'Last Name',
    language: 'Language',
    country: 'Country',

    // Errors
    error: {
      invalid_phone: 'Invalid phone number',
      invalid_password: 'Invalid password',
      invalid_email: 'Invalid email',
      password_mismatch: 'Passwords do not match',
      user_not_found: 'User not found',
      unauthorized: 'Unauthorized',
      network_error: 'Network error',
      timeout: 'Request timeout',
      server_error: 'Server error',
      invalid_amount: 'Invalid amount',
      insufficient_balance: 'Insufficient balance',
      min_deposit: 'Minimum deposit: {amount}',
      max_deposit: 'Maximum deposit: {amount}',
    },

    // Menu
    menu: {
      home: 'Home',
      balance: '💰 Balance',
      deposit: '💳 Deposit',
      withdraw: '💸 Withdraw',
      transactions: '📋 Transactions',
      profile: '👤 Profile',
      settings: '⚙️ Settings',
      support: '📞 Support',
      logout: 'Logout',
    },

    // Home Screen
    home: {
      title: 'Home',
      hello: 'Hello {name}!',
      current_balance: 'Current Balance',
      quick_actions: 'Quick Actions',
      recent_transactions: 'Recent Transactions',
      no_transactions: 'No transactions',
    },

    // Balance Screen
    balance: {
      title: 'Balance',
      current: 'Current Balance',
      total_deposited: 'Total Deposited',
      total_withdrawn: 'Total Withdrawn',
      daily_limit: 'Daily Limit Remaining',
      last_updated: 'Last updated: {time}',
    },

    // Deposit Screen
    deposit: {
      title: 'Deposit',
      enter_amount: 'Enter amount',
      select_method: 'Select payment method',
      bank_transfer: '🏦 Bank Transfer',
      card: '💳 Credit Card',
      wallet: '📱 Digital Wallet',
      confirm_deposit: 'Confirm Deposit',
      amount: 'Amount',
      method: 'Method',
      deposit_submitted: 'Deposit request submitted',
      wait_approval: 'Please wait for request confirmation',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },

    // Withdraw Screen
    withdraw: {
      title: 'Withdraw',
      enter_amount: 'Enter amount',
      select_method: 'Select withdrawal method',
      bank_account: '🏦 Bank Account',
      wallet: '📱 Digital Wallet',
      confirm_withdraw: 'Confirm Withdrawal',
      bank_name: 'Bank Name',
      account_number: 'Account Number',
      iban: 'IBAN',
      wallet_address: 'Wallet Address',
      withdraw_submitted: 'Withdrawal request submitted',
      wait_approval: 'Please wait for request confirmation',
    },

    // Transactions Screen
    transactions: {
      title: 'Transactions',
      no_transactions: 'No transactions',
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
      transfer: 'Transfer',
      commission: 'Commission',
      date: 'Date',
      amount: 'Amount',
      status: 'Status',
      pending: 'Pending',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },

    // Profile Screen
    profile: {
      title: 'Profile',
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      member_since: 'Member since {date}',
      verify_account: 'Verify Account',
      change_password: 'Change Password',
      delete_account: 'Delete Account',
    },

    // Settings Screen
    settings: {
      title: 'Settings',
      language: 'Language',
      currency: 'Currency',
      notifications: 'Notifications',
      push_notifications: 'Push Notifications',
      email_notifications: 'Email Notifications',
      sms_notifications: 'SMS Notifications',
      security: 'Security',
      two_factor_auth: 'Two-Factor Authentication',
      privacy: 'Privacy',
      about: 'About App',
      version: 'Version {version}',
    },

    // Support Screen
    support: {
      title: 'Support',
      category: 'Category',
      subject: 'Subject',
      message: 'Message',
      send: 'Send',
      tickets: 'Tickets',
      create_ticket: 'Create Support Ticket',
      ticket_created: 'Ticket created successfully',
      no_tickets: 'No support tickets',
      status: 'Status',
      open: 'Open',
      closed: 'Closed',
      in_progress: 'In Progress',
    },

    // General
    loading: 'Loading...',
    retry: 'Retry',
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    no_data: 'No data',
    try_again: 'Try Again',
    success: 'Success',
    failed: 'Failed',
    warning: 'Warning',
  },
};
    all_transactions: 'جميع المعاملات',
    pending: 'قيد الانتظار',
    completed: 'مكتمل',
    failed: 'فشل',
    deposit_type: 'إيداع',
    withdrawal_type: 'سحب',
    complaint_type: 'شكوى',
    
    // Profile
    account_info: 'معلومات الحساب',
    customer_code: 'رقم العميل',
    language: 'اللغة',
    country: 'الدولة',
    notifications: 'الإشعارات',
    settings: 'الإعدادات',
    
    // Forms
    amount: 'المبلغ',
    enter_amount: 'أدخل المبلغ',
    payment_method: 'طريقة الدفع',
    select_payment_method: 'اختر طريقة الدفع',
    account_details: 'تفاصيل الحساب',
    notes: 'ملاحظات',
    subject: 'الموضوع',
    description: 'الوصف',
    
    // Messages
    request_submitted: 'تم إرسال الطلب بنجاح',
    request_failed: 'فشل إرسال الطلب',
    no_transactions: 'لا توجد معاملات',
    
    // Errors
    network_error: 'خطأ في الاتصال',
    server_error: 'خطأ في الخادم',
    try_again: 'حاول مرة أخرى',
  },
  en: {
    // Common
    app_name: 'LangSense',
    welcome: 'Welcome',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    submit: 'Submit',
    back: 'Back',
    next: 'Next',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    
    // Auth
    phone_number: 'Phone Number',
    first_name: 'First Name',
    last_name: 'Last Name',
    enter_phone: 'Enter your phone number',
    enter_name: 'Enter your name',
    login_success: 'Login successful',
    register_success: 'Registration successful',
    login_failed: 'Login failed',
    register_failed: 'Registration failed',
    invalid_phone: 'Invalid phone number',
    
    // Navigation
    home: 'Home',
    wallet: 'Wallet',
    transactions: 'Transactions',
    profile: 'Profile',
    
    // Home
    total_balance: 'Total Balance',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    transfer: 'Transfer',
    complaint: 'Complaint',
    
    // Wallet
    available_balance: 'Available Balance',
    locked_balance: 'Locked Balance',
    deposit_title: 'Deposit',
    withdraw_title: 'Withdraw',
    
    // Transactions
    all_transactions: 'All Transactions',
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    deposit_type: 'Deposit',
    withdrawal_type: 'Withdrawal',
    complaint_type: 'Complaint',
    
    // Profile
    account_info: 'Account Information',
    customer_code: 'Customer Code',
    language: 'Language',
    country: 'Country',
    notifications: 'Notifications',
    settings: 'Settings',
    
    // Forms
    amount: 'Amount',
    enter_amount: 'Enter amount',
    payment_method: 'Payment Method',
    select_payment_method: 'Select payment method',
    account_details: 'Account Details',
    notes: 'Notes',
    subject: 'Subject',
    description: 'Description',
    
    // Messages
    request_submitted: 'Request submitted successfully',
    request_failed: 'Failed to submit request',
    no_transactions: 'No transactions',
    
    // Errors
    network_error: 'Network error',
    server_error: 'Server error',
    try_again: 'Try again',
  },
};
