# Comprehensive Error Prediction & Mitigation Plan

## 🚨 Critical Errors (High Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **Auth token expires mid-session, all API calls fail** | All screens making API calls | System | Token expiration (401), no refresh mechanism | Implement token refresh interceptor in [api.js](mobile-app/src/services/api.js); catch 401, refresh token, retry request; if refresh fails, logout gracefully |
| **Network offline, app shows white screen** | App.js initial auth check | System | No network connectivity during app launch | Wrap auth check in try/catch; add offline detector; show "No Connection" screen with retry button; cache last known auth state |
| **AuthContext undefined in child components** | Login/Register/Profile screens | Functional | Context not available if provider missing | Add null check: `const context = useContext(AuthContext); if (!context) throw error`; wrap App in error boundary |
| **Navigation reset to MainTabs fails if user not authenticated** | LoginScreen.js, RegisterScreen.js | Functional | Race condition: navigation before auth state update | Use navigation listener; only reset after `setIsAuthenticated` resolves; add 100ms delay or await state setter |
| **Double submission creates duplicate deposit/withdraw requests** | DepositScreen, WithdrawScreen, ComplaintScreen | UX/System | User taps submit twice before loading state updates | Already fixed with loading state; add request deduplication on backend; track last request ID in AsyncStorage |
| **API returns 500 error, app crashes with unhandled exception** | All API calls (api.js) | System | Backend error, no try/catch in api.request() | Wrap all api.request() calls in try/catch; check response.ok before parsing JSON; return structured error: `{error: true, message, code}` |
| **Form validation passes but API rejects input** | Deposit/Withdraw amount fields | Validation | Client validation differs from server (e.g., max amount) | Fetch validation rules from API on mount; show server-side errors inline; align client validation with backend constraints |
| **User logs out but auth state persists in some screens** | All screens using authService | State | AuthService singleton doesn't notify all consumers | Use event emitter in authService; emit 'logout' event; screens listen and reset state; or use global state manager (Redux/Zustand) |
| **App.js auth check never completes, infinite loading** | App.js | System | authService.isAuthenticated() hangs or throws | Add timeout to auth check (5s); if timeout, set loading false and authenticated false; log error for debugging |
| **SecureStore unavailable on some devices** | authService.js, api.js | System | SecureStore not supported on web or some Android versions | Add fallback: try SecureStore, catch error, use AsyncStorage; show warning: "Tokens stored less securely" |

---

## ⚠️ High-Impact Errors (Medium-High Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **Phone number validation inconsistent (10 vs 11 digits)** | LoginScreen, RegisterScreen | Validation | Different countries have different formats | Use phone validation library (libphonenumber-js); validate based on country code; show format hint below field |
| **Amount input allows negative or zero** | DepositScreen, WithdrawScreen | Validation | parseFloat() allows negative; only client-side check | Add regex validation: `/^\d+(\.\d{1,2})?$/`; disable submit if invalid; show "Must be positive" error |
| **Amount input allows 0.001 (too many decimals)** | DepositScreen, WithdrawScreen | Validation | No decimal precision limit | Limit to 2 decimals in onChange; round on blur; show error if >2 decimals |
| **User enters huge amount (e.g., 999999999)** | DepositScreen, WithdrawScreen | Validation | No max amount validation | Fetch max limits from API or config; show error: "Max amount is X SAR"; disable submit |
| **Payment method field accepts any text** | DepositScreen | Validation | Free text field, no predefined options | Replace with dropdown/picker of valid payment methods from API; or validate against known list |
| **Account details field empty but validation passes** | WithdrawScreen | Validation | Only checks truthiness, but " " (space) is truthy | Trim whitespace: `accountDetails.trim()`; check length > 0; show error: "Required" |
| **Subject/description field allows 10000 characters** | ComplaintScreen | Validation | No max length limit | Add maxLength prop to TextInput (e.g., 500); show character counter; backend should also validate |
| **API returns HTML error page, JSON.parse() fails** | All API calls | System | Server returns 500 as HTML, not JSON | Check Content-Type header before parsing; if not JSON, return generic error; wrap JSON.parse in try/catch |
| **Transaction list shows "undefined" for missing fields** | TransactionsScreen | UX | API returns incomplete transaction objects | Add fallback: `item.amount ?? 'N/A'`; check if field exists before rendering; filter out malformed items |
| **Balance shows "NaN" if API returns null** | HomeScreen | UX | balance is null/undefined, toFixed() called on it | Add default: `(balance ?? 0).toFixed(2)`; check if typeof balance === 'number'; show '—' if null |
| **User taps Quick Action card rapidly, opens screen multiple times** | HomeScreen ServiceCard | UX | No debounce on navigation | Add navigation state check; disable taps for 500ms after first tap; or check if screen already in stack |
| **Refresh control triggers during scroll, unexpected reload** | HomeScreen, TransactionsScreen | UX | Accidental pull-to-refresh | Increase scroll threshold; add slight delay before onRefresh; show confirmation if data will be lost |
| **Form fields don't clear after error then success** | All form screens | UX | resetForm() only called on success, not on retry | Call resetForm() on unmount; or add "Clear Form" button; or reset on second successful submit |
| **User navigates away mid-submission, request completes but no feedback** | All form screens | UX | Navigation happens before request completes | Show toast notification even if navigated away; use global notification system; or block navigation during submit |
| **Keyboard covers submit button on small screens** | All form screens | UX | KeyboardAvoidingView not effective on all devices | Add ScrollView inside KeyboardAvoidingView; ensure submit button has bottom padding; test on smallest device |
| **RTL language but icons/arrows not mirrored** | All screens with arrows | UX | Icons hardcoded, not RTL-aware | Use react-native-vector-icons with RTL support; mirror chevrons: `transform: [{scaleX: isRTL() ? -1 : 1}]` |

---

## 🔧 Functional Errors (Medium Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **Login/register screens accessible when already authenticated** | AppNavigator.js | Functional | Auth stack not properly guarded | Add redirect: if authenticated and on Login, navigate to MainTabs; check auth state in navigator |
| **User can navigate to Deposit/Withdraw while logged out** | AppNavigator navigation | Functional | Deep links or manual navigation bypass auth | Add auth guard HOC; wrap protected screens; redirect to Login if not authenticated |
| **MainTabs visible for a frame before redirecting to Login** | AppNavigator.js | UX | Conditional rendering evaluates after render | Use `initialRouteName` based on auth state; preload auth before rendering NavigationContainer |
| **Balance refetch on every HomeScreen focus** | HomeScreen | Performance | useEffect runs on every navigation | Use `useFocusEffect` with dependency array; debounce API calls; cache balance for 30s |
| **Transaction list doesn't update after deposit/withdraw** | TransactionsScreen | UX | No refresh after form submission | Emit event on success; listen in TransactionsScreen; or use global state; add auto-refresh on focus |
| **Profile screen shows stale user data after update** | ProfileScreen | State | User data fetched once, not refetched | Add pull-to-refresh; re-fetch on focus; or update local state immediately after updateProfile() success |
| **Customer code shows "---" but user has code** | HomeScreen | UX | user object not fully loaded when rendering | Show loading skeleton until user object available; check `user?.customer_code` with optional chaining |
| **Language/country pickers not functional** | ProfileScreen | Functional | Coming Soon badge but no handler | Implement picker modals; call updateProfile() API; reload i18n on language change; show success feedback |
| **Notifications toggle doesn't save preference** | ProfileScreen | Functional | No API endpoint for notification settings | Add API call to save preference; update local state; show confirmation; handle API errors |
| **Tab bar icons too small on tablets** | AppNavigator.js | UX | Fixed font size doesn't scale | Use responsive sizing: `FontSizes.xl * (isTablet ? 1.5 : 1)`; or use icon library with size prop |
| **Transaction date shows "Invalid Date"** | TransactionsScreen | UX | API returns malformed date string | Validate date before toLocaleDateString(); use date library (dayjs/date-fns); show 'N/A' if invalid |
| **Transaction status color doesn't match actual status** | TransactionsScreen | UX | Status string case mismatch ('Pending' vs 'pending') | Normalize to lowercase in getStatusColor(); add fallback color; map all possible status values |
| **Empty transaction list shows no guidance** | TransactionsScreen | UX | Empty state only shows "No transactions" | Add CTA: "Make your first deposit"; button to navigate to DepositScreen; show illustration |
| **Profile avatar shows "U" for undefined user** | ProfileScreen | UX | user.first_name is null/undefined | Add fallback: `(user?.first_name?.[0] ?? 'U').toUpperCase()`; show default user icon instead |

---

## ⚡ Performance & State Errors (Medium Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **Multiple API calls triggered on rapid screen navigation** | All screens with useEffect | Performance | useEffect cleanup not implemented | Add cleanup function: `return () => { cancelled = true }; if (!cancelled) setState()` |
| **Memory leak from uncancelled API requests** | All screens | System | Component unmounts but fetch() continues | Use AbortController; cancel on unmount; wrap setState in isMounted check |
| **AuthContext re-renders all children on every state change** | App.js AuthContext | Performance | Context value is new object on every render | Memoize context value: `useMemo(() => ({isAuth, setIsAuth}), [isAuth])` |
| **Form inputs lag on fast typing** | All text inputs | Performance | State updates on every keystroke | Debounce validation; use controlled inputs sparingly; validate onBlur instead of onChange |
| **Transaction list re-renders all items on scroll** | TransactionsScreen FlatList | Performance | No keyExtractor or item keys | Verify keyExtractor uses stable ID; add `getItemLayout` for fixed-height items; use `removeClippedSubviews` |
| **Images/icons cause layout shift** | All screens | UX | No width/height on images | Set explicit dimensions; use aspectRatio; preload critical images; add placeholder |
| **App freezes when loading large transaction list** | TransactionsScreen | Performance | Rendering 1000+ items at once | Implement pagination; use FlatList windowSize prop; fetch in batches (e.g., 20 per page) |
| **Balance animation causes jank** | HomeScreen | Performance | Heavy animation on balance update | Use `useNativeDriver: true`; avoid layout animations; use LayoutAnimation sparingly |

---

## 🐛 Edge Cases & Rare Scenarios (Low-Medium Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **User changes system language mid-session** | All screens | UX | i18n not reactive to system language changes | Listen to AppState changes; re-initialize i18n; show "Language changed" prompt to restart app |
| **User rotates device, form inputs lose focus** | All form screens | UX | Orientation change triggers re-render | Preserve input state in refs; restore focus after rotation; use TextInput's `key` prop |
| **Copy-paste of phone number includes spaces/dashes** | LoginScreen, RegisterScreen | Validation | User copies "+966 50 123 4567" | Strip non-digits: `phoneNumber.replace(/\D/g, '')`; show formatted number in UI; validate cleaned string |
| **User enters emoji in text fields** | All text inputs | Validation | TextInput allows any Unicode | Add regex to filter: allow only alphanumeric + basic punctuation; show error if invalid characters |
| **API response takes >30s, timeout error** | All API calls | System | Slow network or heavy server load | Show "Taking longer than usual..." after 10s; allow cancel; retry with exponential backoff |
| **Deep link opens app to specific screen but user not authenticated** | App.js linking config | Functional | Deep link bypasses auth check | Intercept deep links; check auth; redirect to Login with return URL; navigate after auth |
| **User has two devices, logs out on one, still logged in on other** | authService | State | No centralized session management | Implement token blacklist on backend; validate token on each request; force logout if invalid |
| **User changes timezone, transaction times show wrong** | TransactionsScreen | UX | Date uses client timezone, server uses UTC | Convert UTC to local time; show timezone hint; or always show in user's preferred timezone from settings |
| **App updated via store, old AsyncStorage data incompatible** | All AsyncStorage usage | System | Schema changed between versions | Version AsyncStorage keys; migrate old data on app launch; clear stale data |
| **User clears app cache, loses all data but token remains** | authService | State | SecureStore persistent but AsyncStorage cleared | Re-fetch user data if AsyncStorage empty but token exists; handle missing user gracefully |
| **User's device runs out of storage mid-operation** | AsyncStorage writes | System | AsyncStorage.setItem() fails silently | Wrap in try/catch; show error: "Storage full"; retry after cleanup; use minimal storage |
| **User spam-taps back button, navigation stack corrupted** | All screens | UX | Multiple goBack() calls in quick succession | Debounce back button; disable after first tap; use navigation.isFocused() check |
| **Complaint with 10000 char description exceeds API limit** | ComplaintScreen | Validation | Client allows more than server accepts | Fetch limits from API; show character counter; prevent submit if over limit; show error |
| **User screenshots form with sensitive data** | All form screens (especially Withdraw) | Security | No screenshot prevention on sensitive screens | Use `ScreenCapture.preventScreenCapture()` on iOS; show blur overlay on Android; warn user |

---

## 🛡️ Security & Data Integrity (Medium Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **Auth token visible in logs/error messages** | api.js, authService.js | Security | console.log() includes full token | Redact tokens in logs; only log last 4 chars; disable logs in production; use secure logging service |
| **Sensitive data in Redux DevTools (if added)** | Future state management | Security | DevTools expose all state | Disable DevTools in production; redact sensitive fields; use secure storage for PII |
| **User data cached insecurely in AsyncStorage** | authService.js | Security | User object stored as plain JSON | Encrypt sensitive fields before storing; or only cache non-sensitive data; use SecureStore for PII |
| **API calls over HTTP in development** | config.js | Security | API_BASE_URL uses http:// | Force HTTPS in production; show warning if http:// detected; fail requests over HTTP in prod |
| **CSRF vulnerability if using cookies** | api.js | Security | No CSRF token in requests | Use JWT in headers (not cookies); or implement CSRF token exchange; validate origin on backend |
| **XSS if rendering user-generated content** | Future: if showing complaint responses | Security | HTML rendering of unsanitized input | Never use dangerouslySetInnerHTML; escape HTML entities; use Text component only |
| **SQL injection via search/filter (backend)** | Backend API | Security | Unsanitized query params | Validate all input; use parameterized queries; limit query complexity; rate-limit search |
| **Replay attack on financial requests** | Deposit/Withdraw forms | Security | No request nonce/timestamp | Add timestamp to request; validate on server; reject old requests (>5min); use idempotency keys |

---

## 🎨 UX Inconsistencies & Minor Issues (Low Priority)

| Error Description | Source (File/Component/Button) | Type | Predicted Cause | Suggested Fix / Solution |
|------------------|--------------------------------|------|-----------------|-------------------------|
| **Color contrast insufficient for accessibility** | All text on colored backgrounds | UX | Colors don't meet WCAG AA standards | Use contrast checker; adjust Colors.textPrimary opacity; test with accessibility tools |
| **Touch targets smaller than 44x44 on some buttons** | Small icon buttons | UX | Padding insufficient | Add minHeight/minWidth: 44; increase padding; add hitSlop prop |
| **No haptic feedback on button taps** | All buttons | UX | No vibration on press | Add `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on onPress |
| **Loading spinner color blends with background** | White spinner on white background | UX | ActivityIndicator color not set | Use Colors.primary for all spinners; add contrast background circle if needed |
| **Success/error colors not color-blind friendly** | Status badges, alerts | UX | Red/green hard to distinguish for some users | Use icons + text; add patterns/shapes; use color-blind safe palette |
| **No skeleton loader, just spinner** | HomeScreen balance, TransactionsScreen | UX | Generic loading state | Replace ActivityIndicator with skeleton placeholder matching content shape |
| **Button text not capitalized consistently** | Some buttons use "Submit", others "submit" | UX | Inconsistent styling | Use uppercase style or title case; define convention; apply globally |
| **No animation on screen transitions** | All navigations | UX | Default slide animation only | Add custom transitions; use fade/scale for modals; match platform conventions |
| **Tab bar labels truncate on small screens** | AppNavigator MainTabs | UX | Long translations don't fit | Use shorter labels; remove label and show icon only; or use scrollable tabs |
| **No loading state on tab switch** | MainTabs | UX | Tab content loads after switch | Preload tab content; show skeleton in inactive tabs; lazy load heavy tabs |
| **Pull-to-refresh arrow/spinner not themed** | HomeScreen, TransactionsScreen | UX | Default system colors | Set tintColor prop to match theme; customize indicator on Android |
| **No "Scroll to Top" button on long lists** | TransactionsScreen | UX | Hard to return to top after scrolling | Add FloatingActionButton; or tap status bar (iOS); double-tap tab icon |
| **Date format doesn't match user's locale** | TransactionsScreen | UX | Hardcoded toLocaleDateString() | Use user's preferred date format from settings; or locale from device |
| **Currency symbol hardcoded to "SAR"** | All monetary displays | UX | No multi-currency support | Get currency from user country or API; use currency codes; format with Intl.NumberFormat |
| **No dark mode support** | All screens | UX | Colors hardcoded to light theme | Implement useColorScheme(); define dark theme colors; use dynamic colors |

---

## 🔄 Systematic Improvements (Implementation Recommendations)

### 1. Global Error Boundary
```javascript
// ErrorBoundary.js
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, info) {
    // Log to error tracking service (Sentry, etc.)
    console.error('Caught error:', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

// Wrap App.js:
<ErrorBoundary><App /></ErrorBoundary>
```

### 2. API Error Interceptor
```javascript
// api.js - Enhanced error handling
async request(endpoint, options = {}) {
  try {
    const response = await this.fetchWithTimeout(url, { ...options, headers });
    
    // Check response status
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = 'Request failed';
      
      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } else {
        errorMessage = await response.text();
      }
      
      throw new APIError(errorMessage, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new NetworkError('Request timeout');
    }
    if (!navigator.onLine) {
      throw new NetworkError('No internet connection');
    }
    throw error;
  }
}
```

### 3. Form Validation Hook
```javascript
// useFormValidation.js
export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const validate = (name, value) => {
    const rules = validationRules[name];
    if (!rules) return '';
    
    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return '';
  };
  
  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validate(name, value) }));
    }
  };
  
  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validate(name, values[name]) }));
  };
  
  const validateAll = () => {
    const newErrors = {};
    Object.keys(validationRules).forEach(name => {
      newErrors[name] = validate(name, values[name]);
    });
    setErrors(newErrors);
    return Object.values(newErrors).every(error => !error);
  };
  
  return { values, errors, touched, handleChange, handleBlur, validateAll, setValues };
};
```

### 4. Offline Support
```javascript
// useNetworkStatus.js
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    return unsubscribe;
  }, []);
  
  return isOnline;
};

// In App.js:
const isOnline = useNetworkStatus();
if (!isOnline) return <OfflineScreen />;
```

### 5. Request Deduplication
```javascript
// api.js - Prevent duplicate requests
class APIService {
  pendingRequests = new Map();
  
  async request(endpoint, options = {}) {
    const key = `${options.method || 'GET'}-${endpoint}-${JSON.stringify(options.body)}`;
    
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    const requestPromise = this._makeRequest(endpoint, options);
    this.pendingRequests.set(key, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}
```

### 6. Comprehensive Logging
```javascript
// logger.js
class Logger {
  static error(component, action, error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      component,
      action,
      error: error.message,
      stack: error.stack,
      ...context,
    };
    
    console.error('[ERROR]', errorLog);
    
    // Send to error tracking service in production
    if (!__DEV__) {
      // Sentry.captureException(error, { extra: errorLog });
    }
  }
  
  static info(component, action, data = {}) {
    if (__DEV__) {
      console.log('[INFO]', component, action, data);
    }
  }
}
```

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (Do First)
- [ ] Add error boundary around entire app
- [ ] Implement API error interceptor with proper error types
- [ ] Add network status detection and offline screen
- [ ] Implement token refresh mechanism
- [ ] Add request deduplication for financial operations
- [ ] Wrap all AsyncStorage/SecureStore calls in try/catch
- [ ] Add timeout protection to all API calls
- [ ] Implement navigation guards for protected routes

### Phase 2: Form & Validation
- [ ] Create reusable form validation hook
- [ ] Add phone number validation library
- [ ] Implement decimal precision limits on amount inputs
- [ ] Add max/min amount validation with API limits
- [ ] Replace free-text payment method with picker
- [ ] Add character counters to all text areas
- [ ] Implement form field sanitization (trim, escape)

### Phase 3: State & Performance
- [ ] Memoize AuthContext value
- [ ] Add AbortController to all API requests
- [ ] Implement useCallback for expensive functions
- [ ] Add FlatList optimization props
- [ ] Implement transaction list pagination
- [ ] Add request caching layer

### Phase 4: UX Enhancements
- [ ] Replace spinners with skeleton loaders
- [ ] Add haptic feedback to buttons
- [ ] Implement custom screen transitions
- [ ] Add "Scroll to Top" on long lists
- [ ] Improve empty states with CTAs
- [ ] Add pull-to-refresh everywhere
- [ ] Implement toast notifications for background actions

### Phase 5: Security
- [ ] Audit and redact tokens in logs
- [ ] Encrypt sensitive data in AsyncStorage
- [ ] Add HTTPS enforcement
- [ ] Implement request signing for financial operations
- [ ] Add rate limiting on client side
- [ ] Prevent screenshots on sensitive screens

### Phase 6: Accessibility & Polish
- [ ] Run WCAG contrast checker on all colors
- [ ] Ensure all touch targets meet 44x44
- [ ] Add screen reader labels everywhere
- [ ] Implement dark mode
- [ ] Add multi-currency support
- [ ] Localize date/number formats
- [ ] Test with VoiceOver/TalkBack

---

## 🎯 Success Metrics

After implementing these fixes, the app should:

1. **Never crash** - All errors caught and handled gracefully
2. **Work offline** - Show appropriate screens, queue actions
3. **Recover automatically** - Retry failed requests, refresh stale tokens
4. **Guide users** - Clear error messages, actionable suggestions
5. **Prevent mistakes** - Validation before submission, confirmations
6. **Perform smoothly** - No lag, no memory leaks, efficient rendering
7. **Be accessible** - Work with screen readers, meet WCAG standards
8. **Be secure** - Protect sensitive data, prevent common attacks

---

*This analysis covers ~150 potential error scenarios across all project files. Priority should be: Critical → Functional → UX → Performance → Polish.*
