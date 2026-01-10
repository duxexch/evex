# Phase 6: QA Implementation Plan – TaskFlowAI Financial System

## 1. UNIT TESTS IMPLEMENTATION

### 1.1 Test File: `tests/unit/test_financial_service.py`

**Module Under Test**: `services/financial_service.py` → `SecureFinancialService`

#### Test Functions to Implement:

| Test ID | Function Name | Target Method | Input Parameters | Expected Output | Pass Criteria | Priority |
|---------|---------------|----------------|------------------|-----------------|---------------|----------|
| **UT-FIN-001** | `test_process_deposit_valid` | `process_deposit()` | user_id=1, amount=Decimal('1000.00'), outbox_id=5, idempotency_key='unique-1', admin_id=999, ip_address='127.0.0.1' | `{'success': True, 'transaction_id': <int>, 'balance_after': '1000.00'}` | Transaction created, User.balance updated to 1000.00, Outbox.status=COMPLETED | **CRITICAL** |
| **UT-FIN-002** | `test_process_deposit_duplicate_idempotency` | `process_deposit()` | Same as UT-FIN-001 but called twice with same idempotency_key | ValueError raised | Exception message contains "معاملة مكررة" | **CRITICAL** |
| **UT-FIN-003** | `test_process_deposit_zero_amount` | `process_deposit()` | amount=Decimal('0') | ValueError raised | Exception message contains "المبلغ يجب أن يكون موجباً" | **HIGH** |
| **UT-FIN-004** | `test_process_deposit_negative_amount` | `process_deposit()` | amount=Decimal('-100.00') | ValueError raised | Exception message contains "المبلغ يجب أن يكون موجباً" | **HIGH** |
| **UT-FIN-005** | `test_process_deposit_user_not_found` | `process_deposit()` | user_id=99999 | ValueError raised | Exception message contains "المستخدم غير موجود" | **CRITICAL** |
| **UT-FIN-006** | `test_process_deposit_banned_user` | `process_deposit()` | user.is_banned=True | ValueError raised | Exception message contains "حسابك محظور" | **HIGH** |
| **UT-FIN-007** | `test_process_deposit_excessive_amount` | `process_deposit()` | amount=Decimal('999999999.99') + Decimal('0.01') | ValueError raised | Exception message contains "المبلغ كبير جداً" | **MEDIUM** |
| **UT-FIN-008** | `test_process_deposit_signature_generation` | `_generate_signature()` | Valid transaction object | signature matches HMAC | Transaction.signature is not None and len > 0 | **CRITICAL** |
| **UT-FIN-009** | `test_process_deposit_decimal_precision` | `process_deposit()` | amount=Decimal('123.45') | balance_after has exactly 2 decimals | No floating-point errors, balance is Decimal type | **CRITICAL** |
| **UT-FIN-010** | `test_process_deposit_audit_logging` | `process_deposit()` | Valid deposit params | AuditLog created | AuditLog.action='APPROVE_DEPOSIT', contains user_id, amount, admin_id | **HIGH** |
| **UT-FIN-011** | `test_process_withdrawal_valid` | `process_withdrawal()` | user_id=1 (balance=1000), amount=Decimal('500.00'), outbox_id=6, idempotency_key='unique-2', admin_id=999, ip_address='127.0.0.1' | `{'success': True, 'transaction_id': <int>, 'balance_after': '500.00'}` | User.balance = 500.00, Transaction.type='DEBIT' | **CRITICAL** |
| **UT-FIN-012** | `test_process_withdrawal_insufficient_balance` | `process_withdrawal()` | user.balance=1000.00, amount=Decimal('1500.00') | ValueError raised | Exception contains "رصيد غير كافي" | **CRITICAL** |
| **UT-FIN-013** | `test_process_withdrawal_daily_limit_exceeded` | `process_withdrawal()` | today_withdrawn=Decimal('9000.00'), daily_limit=Decimal('10000.00'), amount=Decimal('2000.00') | ValueError raised | Exception contains "تم تجاوز الحد اليومي" | **CRITICAL** |
| **UT-FIN-014** | `test_process_withdrawal_at_boundary` | `process_withdrawal()` | amount = remaining_limit exactly | Success | Withdrawal processed exactly at limit boundary | **HIGH** |
| **UT-FIN-015** | `test_process_withdrawal_duplicate_idempotency` | `process_withdrawal()` | Same params called twice | ValueError raised on second call | Duplicate prevention working | **HIGH** |
| **UT-FIN-016** | `test_process_withdrawal_banned_user` | `process_withdrawal()` | user.is_banned=True | ValueError raised | Exception contains "حسابك محظور" | **HIGH** |
| **UT-FIN-017** | `test_process_withdrawal_negative_amount` | `process_withdrawal()` | amount=Decimal('-250.00') | ValueError raised | Exception contains "المبلغ يجب أن يكون موجباً" | **HIGH** |
| **UT-FIN-018** | `test_process_withdrawal_outbox_update` | `process_withdrawal()` | Valid withdrawal with outbox_id | Outbox.status=COMPLETED | outbox.processed_by=admin_id, outbox.processed_at is set | **HIGH** |
| **UT-FIN-019** | `test_calculate_commission_2_percent` | `calculate_commission()` | amount=Decimal('1000.00'), rate=0.02 | Decimal('20.00') | Exact Decimal precision | **HIGH** |
| **UT-FIN-020** | `test_calculate_commission_zero` | `calculate_commission()` | amount=Decimal('100.00'), rate=0.0 | Decimal('0.00') | Zero commission | **MEDIUM** |
| **UT-FIN-021** | `test_calculate_commission_rounding` | `calculate_commission()` | amount=Decimal('33.33'), rate=0.15 | Decimal('5.00') | Proper ROUND_HALF_UP | **MEDIUM** |
| **UT-FIN-022** | `test_calculate_commission_max_precision` | `calculate_commission()` | amount=Decimal('9999.99'), rate=0.0075 | Commission with 2 decimals | Maintains Numeric(15,2) precision | **MEDIUM** |
| **UT-FIN-023** | `test_verify_signature_valid` | `verify_signature()` | Transaction with correct HMAC | True | Signature matches computed hash | **CRITICAL** |
| **UT-FIN-024** | `test_verify_signature_tampered_amount` | `verify_signature()` | Modify transaction.amount after signing | False | Signature verification fails | **CRITICAL** |
| **UT-FIN-025** | `test_verify_signature_missing` | `verify_signature()` | signature=None | False/Exception | Validation fails safely | **HIGH** |
| **UT-FIN-026** | `test_verify_signature_wrong_key` | `verify_signature()` | Sign with key A, verify with key B | False | Signature invalid with wrong key | **HIGH** |

---

### 1.2 Test File: `tests/unit/test_encryption_service.py`

**Module Under Test**: `services/encryption_service.py` → `EncryptionService`

#### Test Functions to Implement:

| Test ID | Function Name | Target Method | Input | Expected Output | Pass Criteria | Priority |
|---------|---------------|----------------|-------|-----------------|---------------|----------|
| **UT-ENC-001** | `test_encrypt_valid_phone` | `encrypt()` | plaintext="+966501234567" | bytes (ciphertext) | Output is bytes, not empty, not equal to plaintext | **CRITICAL** |
| **UT-ENC-002** | `test_encrypt_empty_string` | `encrypt()` | plaintext="" | None | Handles gracefully | **MEDIUM** |
| **UT-ENC-003** | `test_encrypt_arabic_text` | `encrypt()` | plaintext="رقم الهاتف" | bytes (encrypted) | Arabic characters encrypted correctly, can be decrypted | **HIGH** |
| **UT-ENC-004** | `test_decrypt_valid_ciphertext` | `decrypt()` | ciphertext from encrypt("+966501234567") | "+966501234567" | Decrypted plaintext matches original | **CRITICAL** |
| **UT-ENC-005** | `test_decrypt_empty_ciphertext` | `decrypt()` | ciphertext=None or b'' | None | Handles empty safely | **MEDIUM** |
| **UT-ENC-006** | `test_decrypt_corrupted_ciphertext` | `decrypt()` | Modified ciphertext bytes | Exception raised | Fernet.InvalidToken or similar | **HIGH** |
| **UT-ENC-007** | `test_encrypt_decrypt_roundtrip` | `encrypt()` + `decrypt()` | "+966-50-1234567" (with special chars) | Original string | Encrypt→Decrypt identity test | **CRITICAL** |
| **UT-ENC-008** | `test_generate_key_uniqueness` | `generate_key()` | Call twice | Two different keys | Keys are unique | **HIGH** |
| **UT-ENC-009** | `test_generate_key_format` | `generate_key()` | No input | Valid hex string | Key length >= 32 chars, hex format | **MEDIUM** |
| **UT-ENC-010** | `test_encryption_non_deterministic` | `encrypt()` | Same plaintext, multiple calls | Different ciphertexts | Fernet adds timestamp/nonce | **MEDIUM** |

---

### 1.3 Test File: `tests/unit/test_i18n_service.py`

**Module Under Test**: `services/i18n_service.py` → `I18nService`

#### Test Functions to Implement:

| Test ID | Function Name | Target Method | Input | Expected Output | Pass Criteria | Priority |
|---------|---------------|----------------|-------|-----------------|---------------|----------|
| **UT-I18N-001** | `test_get_text_arabic` | `get_text()` | key="auth.welcome", language="ar" | Arabic translation | Returns Arabic text, not key itself | **CRITICAL** |
| **UT-I18N-002** | `test_get_text_english` | `get_text()` | key="auth.welcome", language="en" | English translation | Returns English text | **CRITICAL** |
| **UT-I18N-003** | `test_get_text_nested_key` | `get_text()` | key="financial.deposit.success" | Approval message | Supports dot notation for nested keys | **HIGH** |
| **UT-I18N-004** | `test_get_text_missing_key` | `get_text()` | key="nonexistent.key" | Returns key itself | Fallback behavior works | **MEDIUM** |
| **UT-I18N-005** | `test_get_text_with_variables` | `get_text()` | key="hello", name="أحمد" | "أهلا أحمد" | Variable substitution works | **HIGH** |
| **UT-I18N-006** | `test_get_text_unsupported_language` | `get_text()` | language="fr" | Falls back to Arabic | Default language works | **MEDIUM** |
| **UT-I18N-007** | `test_format_amount_sar_arabic` | `format_amount()` | amount=Decimal('1234.50'), currency="SAR", language="ar" | "ر.س 1,234.50" | Arabic RTL format | **CRITICAL** |
| **UT-I18N-008** | `test_format_amount_sar_english` | `format_amount()` | amount=Decimal('1234.50'), currency="SAR", language="en" | "1,234.50 SAR" | English LTR format | **CRITICAL** |
| **UT-I18N-009** | `test_format_amount_thousands_separator` | `format_amount()` | amount=Decimal('1000000.99') | Contains comma at 1M | Thousands separator correct | **HIGH** |
| **UT-I18N-010** | `test_format_amount_two_decimals` | `format_amount()` | amount=Decimal('100.1') | "100.10" | Always shows 2 decimals | **HIGH** |
| **UT-I18N-011** | `test_format_amount_zero` | `format_amount()` | amount=Decimal('0.00') | "ر.س 0.00" (ar) or "0.00 SAR" (en) | Handles zero correctly | **MEDIUM** |
| **UT-I18N-012** | `test_format_amount_aed_currency` | `format_amount()` | currency="AED", language="ar" | "د.إ 1,000.00" | Correct AED symbol | **MEDIUM** |
| **UT-I18N-013** | `test_format_amount_unknown_currency` | `format_amount()` | currency="XXX" | "1,000.00 XXX" | Fallback to code | **MEDIUM** |
| **UT-I18N-014** | `test_format_date_short_arabic` | `format_date()` | date=date(2026,1,2), language="ar", format="short" | "2 يناير 2026" | Arabic month names | **HIGH** |
| **UT-I18N-015** | `test_format_date_long_arabic` | `format_date()` | format="long" | "الخميس 2 يناير 2026" | Includes weekday | **HIGH** |
| **UT-I18N-016** | `test_format_date_short_english` | `format_date()` | language="en", format="short" | "Jan 02, 2026" | English format | **HIGH** |
| **UT-I18N-017** | `test_format_date_long_english` | `format_date()` | format="long" | "Thursday, January 02, 2026" | Full English format | **HIGH** |
| **UT-I18N-018** | `test_is_rtl_arabic` | `is_rtl()` | language="ar" | True | Arabic is RTL | **HIGH** |
| **UT-I18N-019** | `test_is_rtl_english` | `is_rtl()` | language="en" | False | English is LTR | **HIGH** |
| **UT-I18N-020** | `test_get_pluralized_singular` | `get_pluralized_text()` | count=1, singular_key="transaction", plural_key="transactions" | Singular form | Uses singular_key | **MEDIUM** |
| **UT-I18N-021** | `test_get_pluralized_plural` | `get_pluralized_text()` | count=5 | Plural form | Uses plural_key | **MEDIUM** |

---

### 1.4 Test File: `tests/unit/test_auth_handlers.py`

**Module Under Test**: `handlers/auth.py`

#### Test Functions to Implement:

| Test ID | Function Name | Target Function | Input | Expected Output | Pass Criteria | Priority |
|---------|---------------|-----------------|-------|-----------------|---------------|----------|
| **UT-AUTH-001** | `test_get_or_create_user_new` | `get_or_create_user()` | telegram_id=12345, first_name="أحمد" | User object | user.telegram_id=12345, user.balance=Decimal('0.00'), user is in DB | **CRITICAL** |
| **UT-AUTH-002** | `test_get_or_create_user_existing` | `get_or_create_user()` | telegram_id of existing user | Same user returned | last_seen updated, no duplicate created | **HIGH** |
| **UT-AUTH-003** | `test_get_or_create_user_default_language` | `get_or_create_user()` | No language_code param | User created with default | language_code='ar' | **HIGH** |
| **UT-AUTH-004** | `test_get_or_create_user_all_fields` | `get_or_create_user()` | All optional fields provided | User created | username, last_name stored correctly | **MEDIUM** |
| **UT-AUTH-005** | `test_get_user_by_id_found` | `get_user_by_id()` | telegram_id of existing user | User object | Returns correct user | **HIGH** |
| **UT-AUTH-006** | `test_get_user_by_id_not_found` | `get_user_by_id()` | telegram_id=99999 | None | Graceful not found | **MEDIUM** |
| **UT-AUTH-007** | `test_is_user_admin_true` | `is_user_admin()` | user.is_admin=True | True | Returns True for admin | **CRITICAL** |
| **UT-AUTH-008** | `test_is_user_admin_false` | `is_user_admin()` | user.is_admin=False | False | Returns False for regular user | **CRITICAL** |
| **UT-AUTH-009** | `test_is_user_admin_not_found` | `is_user_admin()` | telegram_id=99999 | False | Non-existent user returns False | **MEDIUM** |
| **UT-AUTH-010** | `test_is_user_agent` | `is_user_agent()` | user.is_agent=True | True | Returns True for agent | **HIGH** |

---

### 1.5 Test File: `tests/unit/test_models.py`

**Module Under Test**: `models.py` (all models)

#### Test Functions to Implement:

| Test ID | Function Name | Model | Field/Constraint | Test Method | Expected Result | Pass Criteria | Priority |
|---------|---------------|-------|------------------|-------------|-----------------|---------------|----------|
| **UT-MOD-001** | `test_user_balance_non_negative` | User | balance | Insert with negative balance | Constraint violation | CheckConstraint('balance >= 0') enforced | **CRITICAL** |
| **UT-MOD-002** | `test_user_telegram_id_unique` | User | telegram_id | Insert duplicate telegram_id | Constraint violation | UniqueConstraint enforced | **CRITICAL** |
| **UT-MOD-003** | `test_user_customer_code_unique` | User | customer_code | Insert duplicate customer_code | Constraint violation | UniqueConstraint enforced | **HIGH** |
| **UT-MOD-004** | `test_transaction_type_enum` | Transaction | type | Insert invalid type (not CREDIT/DEBIT) | Constraint violation | Enum validation | **HIGH** |
| **UT-MOD-005** | `test_transaction_amount_positive` | Transaction | amount | Insert amount <= 0 | Constraint violation | CheckConstraint('amount > 0') | **CRITICAL** |
| **UT-MOD-006** | `test_transaction_balance_consistency` | Transaction | balance logic | CREDIT: balance_after > balance_before | Passes | CheckConstraint validates direction | **HIGH** |
| **UT-MOD-007** | `test_transaction_balance_consistency_debit` | Transaction | balance logic | DEBIT: balance_after < balance_before | Passes | CheckConstraint validates direction | **HIGH** |
| **UT-MOD-008** | `test_transaction_idempotency_unique` | Transaction | idempotency_key | Insert duplicate idempotency_key | Constraint violation | UniqueConstraint enforced | **CRITICAL** |
| **UT-MOD-009** | `test_outbox_status_enum` | Outbox | status | Valid status values (PENDING, APPROVED, COMPLETED) | Passes | Only valid enums accepted | **HIGH** |
| **UT-MOD-010** | `test_audit_log_immutable` | AuditLog | all fields | created_at set, cannot update | Passes | Timestamps correct, no update triggers | **MEDIUM** |
| **UT-MOD-011** | `test_commission_amount_positive` | Commission | amount | Insert amount <= 0 | Constraint violation | CheckConstraint enforced | **HIGH** |
| **UT-MOD-012** | `test_commission_rate_precision` | Commission | rate | Insert rate=0.025 | Stored as Numeric(5,4) | Proper precision maintained | **MEDIUM** |

---

## 2. INTEGRATION TESTS IMPLEMENTATION

### 2.1 Test File: `tests/integration/test_e2e_flows.py`

**Purpose**: End-to-end user workflows

#### Test Functions to Implement:

| Test ID | Function Name | Flow | Steps | Key Assertions | Duration Target | Priority |
|---------|---------------|------|-------|-----------------|-----------------|----------|
| **IT-E2E-001** | `test_register_login_deposit_flow` | Register → Login → Deposit | 1. Create user via `get_or_create_user()` 2. Generate JWT token 3. Call `POST /deposit` 4. Admin approves 5. Verify balance | User created, token valid, deposit COMPLETED, balance=1000 | < 2s total | **CRITICAL** |
| **IT-E2E-002** | `test_deposit_withdrawal_sequence` | Deposit → Withdrawal | 1. Deposit 1000 2. Withdraw 500 3. Check balance | Balance: 1000 → 500, both transactions audited | < 3s | **CRITICAL** |
| **IT-E2E-003** | `test_multi_deposit_accumulation` | Multiple deposits | 1. Deposit 500 2. Deposit 300 3. Deposit 200 | Final balance=1000, 3 separate Transaction records | < 5s | **HIGH** |
| **IT-E2E-004** | `test_daily_limit_enforcement` | Daily limit check | 1. Withdraw 5000 2. Withdraw 3000 3. Attempt 2500 | Steps 1-2 succeed, step 3 rejected with "تم تجاوز الحد اليومي" | < 5s | **CRITICAL** |
| **IT-E2E-005** | `test_commission_calculation` | Commission flow | 1. Deposit 1000 with 2% commission 2. Withdraw 500 with 3% commission | Commission records created, deducted from withdrawal | < 3s | **HIGH** |
| **IT-E2E-006** | `test_concurrent_deposits_atomicity` | Race condition test | User A and B deposit simultaneously | Both succeed atomically, no duplicate IDs, balances consistent | < 2s | **HIGH** |
| **IT-E2E-007** | `test_admin_approval_workflow` | Admin flow | 1. User submits withdrawal (Outbox.status=PENDING) 2. Admin approves 3. Status→COMPLETED | Outbox state transitions, User.balance decremented, audit logged | < 2s | **HIGH** |
| **IT-E2E-008** | `test_idempotency_protection` | Idempotency | Submit same withdrawal twice with same idempotency_key | First succeeds, second rejected with "معاملة مكررة" | < 1s | **CRITICAL** |
| **IT-E2E-009** | `test_failed_transaction_rollback` | Rollback test | Process deposit, fail during audit log insertion | User.balance unchanged, Transaction not created, session rolled back | < 1s | **HIGH** |
| **IT-E2E-010** | `test_banned_user_blocks_all_transactions` | Ban enforcement | 1. Ban user 2. Attempt deposit 3. Attempt withdrawal | Both fail with "حسابك محظور" | < 1s | **HIGH** |
| **IT-E2E-011** | `test_ledger_consistency_after_operations` | Ledger integrity | After 10 random transactions | Sum(User.balance) + Sum(Commission.amount) = Sum(deposits) - Sum(withdrawals) | < 5s | **CRITICAL** |
| **IT-E2E-012** | `test_audit_log_completeness` | Audit trail | Every financial operation | AuditLog created with action, admin_id, target_id, details, ip_address, timestamp | < 2s | **HIGH** |

---

### 2.2 Test File: `tests/integration/test_mobile_integration.py`

**Purpose**: Mobile API endpoint integration

#### Test Functions to Implement:

| Test ID | Function Name | Endpoint | Request | Expected Response | Assertions | Priority |
|---------|---------------|----------|---------|-------------------|-----------|----------|
| **IT-MOB-001** | `test_register_endpoint` | `POST /auth/register` | {phone, password, first_name, last_name, language} | {user, access_token, refresh_token} | Token stored, user in AsyncStorage, status=201 | **CRITICAL** |
| **IT-MOB-002** | `test_login_endpoint` | `POST /auth/login` | {phone, password} | {user, access_token, refresh_token} | Token valid, matches JWT schema | **CRITICAL** |
| **IT-MOB-003** | `test_logout_endpoint` | `POST /auth/logout` | Valid JWT | {message: "success"} | Token blacklisted (if implemented) | **HIGH** |
| **IT-MOB-004** | `test_balance_endpoint` | `GET /financial/balance` | Valid JWT | {balance: Decimal, total_deposited, total_withdrawn} | Balance matches User.balance in DB | **CRITICAL** |
| **IT-MOB-005** | `test_create_deposit_endpoint` | `POST /financial/deposits` | {amount: 1000, payment_method: "bank"} | {request_id, status: "pending"} | Outbox created with type=DEPOSIT, status=PENDING | **CRITICAL** |
| **IT-MOB-006** | `test_create_withdrawal_endpoint` | `POST /financial/withdrawals` | {amount: 500, account_details, method} | {request_id, status: "pending"} | Outbox created with type=WITHDRAWAL | **CRITICAL** |
| **IT-MOB-007** | `test_get_transactions_endpoint` | `GET /financial/transactions` | Valid JWT, pagination params | {[transactions], total, page, limit} | All user transactions returned, sorted by date DESC | **HIGH** |
| **IT-MOB-008** | `test_unauthorized_access` | Any endpoint | Missing/invalid JWT | {detail: "UNAUTHORIZED"}, status=401 | Request rejected | **CRITICAL** |
| **IT-MOB-009** | `test_cross_user_access_prevention` | `GET /financial/balance` | User A's token requesting User B's balance | {detail: "FORBIDDEN"}, status=403 | User isolation enforced | **CRITICAL** |
| **IT-MOB-010** | `test_token_refresh_flow` | `POST /auth/refresh` | {refresh_token} | {access_token, refresh_token} | New tokens valid, old tokens invalidated | **HIGH** |
| **IT-MOB-011** | `test_network_error_handling` | Any endpoint | Request timeout > 30s | Error response with retry info | Timeout managed gracefully | **MEDIUM** |
| **IT-MOB-012** | `test_deposit_with_receipt` | `POST /financial/deposits` | {amount, method, receipt_url} | {request_id} | receipt_url stored in Outbox.extra_data | **MEDIUM** |

---

### 2.3 Test File: `tests/integration/test_i18n_integration.py`

**Purpose**: Multi-language financial operations

#### Test Functions to Implement:

| Test ID | Function Name | Language | Operation | UI Text Expected | Amount Format | Assertion | Priority |
|---------|---------------|----------|-----------|------------------|----------------|-----------|----------|
| **IT-I18N-001** | `test_deposit_notification_arabic` | ar | Deposit success | "تم قبول إيداعك بنجاح" | "ر.س 1,000.00" | Text and format correct | **HIGH** |
| **IT-I18N-002** | `test_deposit_notification_english` | en | Deposit success | "Your deposit has been approved" | "1,000.00 SAR" | Text and format correct | **HIGH** |
| **IT-I18N-003** | `test_withdrawal_error_arabic` | ar | Insufficient balance | "رصيد غير كافي" | "ر.س 500.00" | Error message correct | **HIGH** |
| **IT-I18N-004** | `test_withdrawal_error_english` | en | Insufficient balance | "Insufficient balance" | "500.00 SAR" | Error message correct | **HIGH** |
| **IT-I18N-005** | `test_rtl_layout_arabic` | ar | UI rendering | Text aligned right | N/A | is_rtl()=True, RTL CSS applied | **MEDIUM** |
| **IT-I18N-006** | `test_ltr_layout_english` | en | UI rendering | Text aligned left | N/A | is_rtl()=False, LTR CSS applied | **MEDIUM** |
| **IT-I18N-007** | `test_currency_formatting_consistency` | ar, en | Format 1234.50 SAR | ar: "ر.س 1,234.50", en: "1,234.50 SAR" | Different symbol placement | Both formats correct | **HIGH** |
| **IT-I18N-008** | `test_date_formatting_arabic` | ar | Format date(2026,1,2) | "2 يناير 2026" | Arabic month names | Correct month translation | **MEDIUM** |
| **IT-I18N-009** | `test_date_formatting_english` | en | Format date(2026,1,2) | "Jan 02, 2026" | English month names | Correct month abbreviation | **MEDIUM** |
| **IT-I18N-010** | `test_unsupported_language_fallback` | fr | Request with lang="fr" | Falls back to Arabic | "ر.س ..." | Fallback chain works | **MEDIUM** |

---

## 3. LOAD TESTS IMPLEMENTATION

### 3.1 Test File: `tests/load/locustfile.py`

**Tool**: Locust (HTTP load testing)
**Base Configuration**:

```
Database: PostgreSQL (connection pool size=10, overflow=20)
API Server: http://localhost:8000
Load Scenarios: 100, 500, 1000 concurrent users
Duration: 5-15 minutes per scenario
Metrics: Response times (avg, p50, p95, p99, max), error rate, throughput
```

#### Scenario 1: 100 Concurrent Users

| Endpoint | Ramp-up | Duration | Req/User | Target p95 | Target p99 | Target Error % |
|----------|---------|----------|----------|-----------|-----------|-----------------|
| `POST /financial/deposits` | 100 users/10s | 5 min | 10 | < 500ms | < 1s | < 2% |
| `POST /financial/withdrawals` | 100 users/10s | 5 min | 10 | < 500ms | < 1s | < 2% |
| `GET /financial/balance` | 100 users/10s | 5 min | 20 | < 100ms | < 300ms | < 0.5% |
| `POST /auth/login` | 100 users/10s | 5 min | 5 | < 500ms | < 1s | < 3% |
| `GET /financial/transactions` | 100 users/10s | 5 min | 10 | < 200ms | < 500ms | < 1% |

#### Scenario 2: 500 Concurrent Users

| Endpoint | Ramp-up | Duration | Target p95 | Target Error % |
|----------|---------|----------|-----------|-----------------|
| `POST /financial/deposits` | 500 users/30s | 10 min | < 600ms | < 3% |
| `POST /financial/withdrawals` | 500 users/30s | 10 min | < 700ms | < 3% |
| `GET /financial/balance` | 500 users/30s | 10 min | < 200ms | < 1% |
| `POST /auth/login` | 500 users/30s | 10 min | < 700ms | < 5% |

#### Scenario 3: 1000 Concurrent Users

| Endpoint | Ramp-up | Duration | Target p95 | Target Error % | Expected Throughput |
|----------|---------|----------|-----------|-----------------|---------------------|
| `POST /financial/deposits` | 1000 users/60s | 15 min | < 1s | < 5% | > 50 deposits/sec |
| `POST /financial/withdrawals` | 1000 users/60s | 15 min | < 1s | < 5% | > 50 withdrawals/sec |
| `GET /financial/balance` | 1000 users/60s | 15 min | < 500ms | < 2% | > 100 req/sec |

#### Key Assertions for Load Tests:

1. **Database Connection Pool**: No exhaustion, max 50/50 connections used
2. **Memory Stability**: No growth > 20% per 5-min interval
3. **Transaction Atomicity**: 100% of deposits/withdrawals complete ACID-compliant
4. **Latency Distribution**: p99 < 2x p50
5. **Error Recovery**: Failed requests do not cascade
6. **Database Queries**: No N+1 queries, avg < 50ms

---

## 4. SECURITY TESTS IMPLEMENTATION

### 4.1 Test File: `tests/security/test_auth_security.py`

**Purpose**: JWT token and authentication security

#### Test Functions:

| Test ID | Function Name | Attack Vector | Method | Expected | Pass Criteria | Priority |
|---------|---------------|----------------|--------|----------|--------------|----------|
| **SEC-AUTH-001** | `test_expired_token_rejected` | Expired token | Create token with exp < now | 401 Unauthorized | Request rejected | **CRITICAL** |
| **SEC-AUTH-002** | `test_tampered_jwt_rejected` | JWT payload modification | Modify user_id in JWT payload | 401 Unauthorized | Signature verification fails | **CRITICAL** |
| **SEC-AUTH-003** | `test_invalid_signature` | Wrong secret key | Sign with key A, verify with key B | 401 Unauthorized | JWTError raised | **CRITICAL** |
| **SEC-AUTH-004** | `test_missing_token` | No Authorization header | Omit header | 401 Unauthorized | No access to protected routes | **CRITICAL** |
| **SEC-AUTH-005** | `test_invalid_token_format` | Malformed token | Bearer "invalid..garbage.." | 401 Unauthorized | Decode fails | **HIGH** |
| **SEC-AUTH-006** | `test_privilege_escalation` | Admin elevation | User sets is_admin=True in request | Unchanged | is_admin not updatable by user | **CRITICAL** |
| **SEC-AUTH-007** | `test_cross_user_access` | User isolation | User A requests User B's /balance | 403 Forbidden | get_current_user enforces ownership | **CRITICAL** |
| **SEC-AUTH-008** | `test_inactive_user_blocked` | Deactivated account | is_active=False, attempt transaction | 403 Forbidden | is_active check prevents access | **HIGH** |
| **SEC-AUTH-009** | `test_refresh_token_flow` | Token refresh | Use refresh_token to get new access_token | New tokens valid | Tokens replaced, old invalidated | **HIGH** |
| **SEC-AUTH-010** | `test_multiple_concurrent_logins` | Session hijacking | Same user logs in from 2 IPs simultaneously | Both succeed | IP tracking optional, both valid | **MEDIUM** |

---

### 4.2 Test File: `tests/security/test_rate_limiting.py`

**Purpose**: Brute force and DDoS prevention

#### Test Functions:

| Test ID | Function Name | Endpoint | Limit | Test Method | Expected | Pass Criteria | Priority |
|---------|---------------|----------|-------|------------|----------|--------------|----------|
| **SEC-RATE-001** | `test_login_rate_limit` | `POST /auth/login` | 5/min/IP | Send 6 attempts | 6th fails 429 | Too Many Requests | **CRITICAL** |
| **SEC-RATE-002** | `test_deposit_rate_limit` | `POST /financial/deposits` | 10/hour/user | Send 11 requests | 11th fails 429 | Too Many Requests | **CRITICAL** |
| **SEC-RATE-003** | `test_withdrawal_rate_limit` | `POST /financial/withdrawals` | 20/day/user | Send 21 requests | 21st fails 429 | Too Many Requests | **CRITICAL** |
| **SEC-RATE-004** | `test_rate_limit_window_reset` | Any endpoint | Per-minute limit | Wait for window to expire | Request succeeds | After reset, limit renewed | **HIGH** |
| **SEC-RATE-005** | `test_distributed_attack` | Multiple IPs, same user | Per-IP enforcement | 5 requests from 5 IPs | All succeed (per-IP) | Per-IP limit independent | **MEDIUM** |
| **SEC-RATE-006** | `test_rate_limit_headers` | Any endpoint | Limit headers | Check response headers | X-RateLimit-Limit, X-RateLimit-Remaining | Headers present | **MEDIUM** |

---

### 4.3 Test File: `tests/security/test_signature_security.py`

**Purpose**: HMAC-SHA256 signature integrity

#### Test Functions:

| Test ID | Function Name | Scenario | Tampering | Expected | Pass Criteria | Priority |
|---------|---------------|----------|-----------|----------|--------------|----------|
| **SEC-SIG-001** | `test_valid_signature` | Valid transaction | None | Signature valid | `verify_signature()` returns True | **CRITICAL** |
| **SEC-SIG-002** | `test_amount_tampering_detected` | Deposit 1000 | Change amount to 2000 | Signature invalid | `verify_signature()` returns False | **CRITICAL** |
| **SEC-SIG-003** | `test_user_id_tampering` | Withdraw for user 1 | Change user_id to 2 | Signature invalid | HMAC mismatch | **CRITICAL** |
| **SEC-SIG-004** | `test_timestamp_tampering` | Any transaction | Modify created_at | Signature invalid | Timestamp included in hash | **HIGH** |
| **SEC-SIG-005** | `test_balance_field_tampering` | Deposit, balance_before=1000 | Change to 500 | Signature invalid | All fields in signature | **HIGH** |
| **SEC-SIG-006** | `test_replay_attack_prevention` | Copy valid signature | Reuse same signature | Rejected | Idempotency_key prevents replay | **HIGH** |
| **SEC-SIG-007** | `test_cross_transaction_signature` | Trans A signature | Use on Trans B | Invalid | Each signature transaction-specific | **MEDIUM** |

---

### 4.4 Test File: `tests/security/test_encryption_security.py`

**Purpose**: Data encryption and key management

#### Test Functions:

| Test ID | Function Name | Data | Test | Expected | Pass Criteria | Priority |
|---------|---------------|------|------|----------|--------------|----------|
| **SEC-ENC-001** | `test_phone_encrypted_in_db` | Phone number | Query DB | Stored as bytes, not plaintext | No plaintext phone in DB | **CRITICAL** |
| **SEC-ENC-002** | `test_phone_decrypted_on_read` | Encrypted phone | Retrieve & decrypt | Plaintext phone in memory | Application sees plaintext only | **CRITICAL** |
| **SEC-ENC-003** | `test_plaintext_not_in_logs` | Phone in error | Check logs | No plaintext phone logged | Logs contain [ENCRYPTED] or [REDACTED] | **HIGH** |
| **SEC-ENC-004** | `test_key_rotation_transparent` | Old encrypted data | Decrypt with new key | Still retrievable | Re-encryption works seamlessly | **MEDIUM** |
| **SEC-ENC-005** | `test_encryption_key_security` | KEY_ENCRYPTION env var | Check .gitignore | Not committed | KEY_ENCRYPTION in .gitignore | **CRITICAL** |

---

### 4.5 Test File: `tests/security/test_input_validation.py`

**Purpose**: SQL injection, XSS, input validation

#### Test Functions:

| Test ID | Function Name | Endpoint | Payload | Expected | Pass Criteria | Priority |
|---------|---------------|----------|---------|----------|--------------|----------|
| **SEC-SQL-001** | `test_sql_injection_deposit` | `POST /deposits` | amount="1000; DROP TABLE users; --" | Properly escaped | No SQL execution | **CRITICAL** |
| **SEC-SQL-002** | `test_sql_injection_name` | `POST /register` | first_name="'; DROP TABLE users; --" | Stored as literal | No SQL execution | **CRITICAL** |
| **SEC-XSS-003** | `test_xss_prevention` | `GET /transactions` | ?search="<script>alert('xss')</script>" | HTML-escaped | No JavaScript execution | **HIGH** |
| **SEC-VAL-004** | `test_negative_amount_rejected` | `POST /deposits` | amount="-999999.99" | Validation error | Decimal type check | **CRITICAL** |
| **SEC-VAL-005** | `test_non_numeric_amount` | `POST /deposits` | amount="abc123" | Type error | Schema validation fails | **HIGH** |
| **SEC-VAL-006** | `test_missing_required_field` | `POST /deposits` | {payment_method only} | 422 Unprocessable Entity | Pydantic validation | **HIGH** |
| **SEC-VAL-007** | `test_boundary_max_amount` | `POST /deposits` | amount=Decimal('1000000.00') | Accepted | Within limits | **MEDIUM** |
| **SEC-VAL-008** | `test_boundary_min_amount` | `POST /deposits` | amount=Decimal('0.01') | Accepted | Minimum valid amount | **MEDIUM** |

---

## 5. TEST EXECUTION GUIDELINES

### 5.1 Directory Structure to Create

```
tests/
├── __init__.py
├── conftest.py                                    # Pytest fixtures
├── unit/
│   ├── __init__.py
│   ├── test_financial_service.py                 # 26 tests
│   ├── test_encryption_service.py                # 10 tests
│   ├── test_i18n_service.py                      # 21 tests
│   ├── test_auth_handlers.py                     # 10 tests
│   └── test_models.py                            # 12 tests
├── integration/
│   ├── __init__.py
│   ├── test_e2e_flows.py                         # 12 tests
│   ├── test_mobile_integration.py                # 12 tests
│   └── test_i18n_integration.py                  # 10 tests
├── security/
│   ├── __init__.py
│   ├── test_auth_security.py                     # 10 tests
│   ├── test_rate_limiting.py                     # 6 tests
│   ├── test_signature_security.py                # 7 tests
│   ├── test_encryption_security.py               # 5 tests
│   └── test_input_validation.py                  # 8 tests
├── load/
│   ├── __init__.py
│   ├── locustfile.py                             # Locust load scenarios
│   └── load_config.yaml                          # Load test parameters
└── fixtures/
    ├── test_data.json                            # Test user/transaction data
    └── conftest_db.py                            # DB-specific fixtures
```

---

### 5.2 CI/CD Integration File: `.github/workflows/test.yml`

**GitHub Actions workflow points**:

1. **Trigger**: On every push and PR
2. **Jobs**:
   - `unit-tests`: pytest tests/unit, coverage > 80%
   - `integration-tests`: pytest tests/integration
   - `security-tests`: pytest tests/security
   - `load-tests` (optional, on main branch only): locust scenarios
3. **Artifacts**: HTML coverage reports, load test results
4. **Exit conditions**: FAIL if coverage < 80% or any CRITICAL test fails

---

## 6. TEST EXECUTION COMMANDS

```bash
# Unit tests only
pytest tests/unit -v --tb=short

# Integration tests
pytest tests/integration -v --tb=short

# Security tests
pytest tests/security -v --tb=short

# All tests with coverage
pytest tests/ --cov=services --cov=handlers --cov=api --cov-report=html

# Load tests (Locust)
locust -f tests/load/locustfile.py --headless -u 100 -r 10 -t 5m

# Run critical tests only
pytest tests/ -m critical -v

# Run by priority
pytest tests/ -m "critical or high" -v
```

---

## 7. SUCCESS CRITERIA

### 7.1 Unit Test Acceptance

- **Coverage Target**: ≥ 80% of financial_service.py, encryption_service.py, i18n_service.py
- **Pass Rate**: 100% of CRITICAL and HIGH priority tests
- **Execution Time**: All unit tests complete in < 60 seconds

### 7.2 Integration Test Acceptance

- **Coverage**: All 12 E2E flows passing
- **Ledger Consistency**: Sum check passes after every test
- **Audit Trail**: Every financial operation has AuditLog entry
- **Idempotency**: Duplicate requests handled correctly

### 7.3 Load Test Acceptance

- **100 users**: p95 < 500ms, error rate < 2%
- **500 users**: p95 < 600ms, error rate < 3%
- **1000 users**: p95 < 1s, error rate < 5%, throughput > 50 req/sec
- **Database**: No connection pool exhaustion, no memory leaks

### 7.4 Security Test Acceptance

- **0 CRITICAL vulnerabilities**
- **JWT**: All tampering detected, expired tokens rejected
- **Encryption**: No plaintext sensitive data in logs or DB
- **Rate Limiting**: All limits enforced per spec
- **Input Validation**: SQL injection, XSS, type mismatches blocked

---

## 8. EFFORT ESTIMATION & TIMELINE

### Phase 6 Testing Timeline (3 Weeks)

**Week 1: Unit & Encryption Tests**
- Day 1-2: `conftest.py` + financial_service tests (26 tests)
- Day 3: encryption_service tests (10 tests)
- Day 4: i18n_service tests (21 tests)
- Day 5: auth_handlers + models tests (22 tests)
- **Effort**: 40 hours | **Coverage**: 79 tests

**Week 2: Integration & Security**
- Day 1-2: E2E flows tests (12 tests)
- Day 3: Mobile integration tests (12 tests)
- Day 4-5: Security tests (36 tests)
- **Effort**: 35 hours | **Coverage**: 60 tests

**Week 3: Load Tests & CI/CD**
- Day 1-2: Locust load test scenarios (3 scenarios)
- Day 3: GitHub Actions workflow setup
- Day 4: Load test execution & optimization
- Day 5: Final review, report generation
- **Effort**: 25 hours

**Total Effort**: 100 hours (~2.5 engineering weeks)
**Total Tests**: 139 unit + integration + security tests + 3 load scenarios

---

## 9. REPORTING REQUIREMENTS

### 9.1 Test Execution Report Structure

```
TEST EXECUTION REPORT – Phase 6
==============================

Execution Date: [DATE]
Total Tests Run: 139
Passed: [X]/139 (X%)
Failed: [Y]/139 (Y%)
Skipped: [Z]/139 (Z%)

By Category:
- Unit Tests: [X]/79 passed
- Integration Tests: [X]/34 passed
- Security Tests: [X]/36 passed

Code Coverage:
- services/financial_service.py: X%
- services/encryption_service.py: X%
- services/i18n_service.py: X%
- handlers/auth.py: X%
- models.py: X%
TOTAL: X%

Load Test Results:
- 100 users: p95=Xms, error rate=X%
- 500 users: p95=Xms, error rate=X%
- 1000 users: p95=Xms, error rate=X%

Security Findings:
- Critical Issues: 0
- High Issues: X
- Medium Issues: X

Recommendations:
[List any optimizations or fixes needed]
```

---

## 10. DELIVERABLES CHECKLIST

- [ ] `tests/conftest.py` – Pytest fixtures and DB setup
- [ ] `tests/unit/test_financial_service.py` – 26 unit tests
- [ ] `tests/unit/test_encryption_service.py` – 10 unit tests
- [ ] `tests/unit/test_i18n_service.py` – 21 unit tests
- [ ] `tests/unit/test_auth_handlers.py` – 10 unit tests
- [ ] `tests/unit/test_models.py` – 12 unit tests
- [ ] `tests/integration/test_e2e_flows.py` – 12 integration tests
- [ ] `tests/integration/test_mobile_integration.py` – 12 integration tests
- [ ] `tests/integration/test_i18n_integration.py` – 10 integration tests
- [ ] `tests/security/test_auth_security.py` – 10 security tests
- [ ] `tests/security/test_rate_limiting.py` – 6 security tests
- [ ] `tests/security/test_signature_security.py` – 7 security tests
- [ ] `tests/security/test_encryption_security.py` – 5 security tests
- [ ] `tests/security/test_input_validation.py` – 8 security tests
- [ ] `tests/load/locustfile.py` – Load test scenarios
- [ ] `.github/workflows/test.yml` – CI/CD workflow
- [ ] `pytest.ini` – Pytest configuration
- [ ] `TEST_EXECUTION_REPORT.md` – Final test results

---

**This plan is complete and ready for execution by QA and Engineering teams.**

