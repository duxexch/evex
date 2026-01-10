import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:url_launcher/url_launcher.dart';

// VEX Platform Flutter Wrapper
// تطبيق Flutter لمنصة VEX

// ============================================
// تعليمات الإعداد:
// 1. غيّر الرابط أدناه إلى رابط موقعك
// 2. أضف أيقونة التطبيق في assets/icon/icon.png
// 3. أضف صورة البداية في assets/splash/splash.png
// 4. شغّل: flutter pub get
// 5. شغّل: flutter build apk --release
// ============================================

// رابط الموقع - غيّره إلى رابط موقعك
const String websiteUrl = 'https://yourdomain.com';

// ألوان التطبيق
const Color primaryColor = Color(0xFF00c853);
const Color backgroundColor = Color(0xFF0f1419);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: backgroundColor,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const VexApp());
}

class VexApp extends StatelessWidget {
  const VexApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VEX',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.green,
        scaffoldBackgroundColor: backgroundColor,
        appBarTheme: const AppBarTheme(
          backgroundColor: backgroundColor,
          elevation: 0,
        ),
      ),
      home: const WebViewScreen(),
    );
  }
}

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController controller;
  bool isLoading = true;
  bool hasError = false;
  bool isConnected = true;
  double loadingProgress = 0;

  @override
  void initState() {
    super.initState();
    checkConnectivity();
    initWebView();
  }

  Future<void> checkConnectivity() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    setState(() {
      isConnected = connectivityResult != ConnectivityResult.none;
    });

    Connectivity().onConnectivityChanged.listen((result) {
      setState(() {
        isConnected = result != ConnectivityResult.none;
        if (isConnected && hasError) {
          hasError = false;
          controller.reload();
        }
      });
    });
  }

  Future<void> _launchExternalUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void initWebView() {
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(backgroundColor)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              loadingProgress = progress / 100;
            });
          },
          onPageStarted: (String url) {
            setState(() {
              isLoading = true;
              hasError = false;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              isLoading = false;
            });
          },
          onWebResourceError: (WebResourceError error) {
            setState(() {
              hasError = true;
              isLoading = false;
            });
          },
          onNavigationRequest: (NavigationRequest request) {
            // السماح بجميع الروابط داخل الموقع
            if (request.url.startsWith(websiteUrl)) {
              return NavigationDecision.navigate;
            }
            // فتح الروابط الخارجية في المتصفح الخارجي
            _launchExternalUrl(request.url);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(websiteUrl));
  }

  Future<bool> onWillPop() async {
    if (await controller.canGoBack()) {
      await controller.goBack();
      return false;
    }
    return showExitDialog();
  }

  Future<bool> showExitDialog() async {
    return await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1a1f2e),
        title: const Text(
          'خروج من التطبيق',
          style: TextStyle(color: Colors.white),
          textAlign: TextAlign.center,
        ),
        content: const Text(
          'هل تريد الخروج من التطبيق؟',
          style: TextStyle(color: Colors.grey),
          textAlign: TextAlign.center,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('لا', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('نعم', style: TextStyle(color: primaryColor)),
          ),
        ],
      ),
    ) ?? false;
  }

  Widget buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isConnected ? Icons.error_outline : Icons.wifi_off,
              size: 80,
              color: Colors.grey,
            ),
            const SizedBox(height: 24),
            Text(
              isConnected ? 'حدث خطأ في التحميل' : 'لا يوجد اتصال بالإنترنت',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              isConnected
                  ? 'يرجى المحاولة مرة أخرى'
                  : 'يرجى التحقق من اتصالك بالإنترنت',
              style: const TextStyle(fontSize: 16, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  hasError = false;
                  isLoading = true;
                });
                controller.reload();
              },
              icon: const Icon(Icons.refresh),
              label: const Text('إعادة المحاولة'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 16,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: onWillPop,
      child: Scaffold(
        backgroundColor: backgroundColor,
        body: SafeArea(
          child: Stack(
            children: [
              if (!hasError) WebViewWidget(controller: controller),
              if (hasError) buildErrorWidget(),
              if (isLoading && !hasError)
                Column(
                  children: [
                    LinearProgressIndicator(
                      value: loadingProgress,
                      backgroundColor: backgroundColor,
                      valueColor: const AlwaysStoppedAnimation<Color>(primaryColor),
                    ),
                    const Expanded(
                      child: Center(
                        child: CircularProgressIndicator(
                          color: primaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
