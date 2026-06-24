import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';
import 'package:eazzio_telecaller/screens/splash_screen.dart';

final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.light);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Shared Preferences and Auth configuration cache
  await ApiService.init();

  // Load theme preference
  final prefs = await SharedPreferences.getInstance();
  final isLight = prefs.getBool('is_light_theme') ?? true;
  themeNotifier.value = isLight ? ThemeMode.light : ThemeMode.dark;

  runApp(const EazzioApp());
}

class EazzioApp extends StatelessWidget {
  const EazzioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (_, ThemeMode currentMode, __) {
        return MaterialApp(
          navigatorKey: ApiService.navigatorKey,
          title: 'Eazzio Telecaller',
          debugShowCheckedModeBanner: false,
          themeMode: currentMode,
          theme: ThemeData(
            brightness: Brightness.light,
            primaryColor: const Color(0xFF6366F1),
            scaffoldBackgroundColor: const Color(0xFFF9FAFB),
            useMaterial3: true,
            dialogTheme: const DialogThemeData(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
            ),
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF6366F1),
              secondary: Color(0xFFA855F7),
              surface: Colors.white,
              error: Color(0xFFEF4444),
              onPrimary: Colors.white,
              onSecondary: Colors.white,
              onSurface: Colors.black,
            ),
          ),
          darkTheme: ThemeData(
            brightness: Brightness.dark,
            primaryColor: const Color(0xFF6366F1),
            scaffoldBackgroundColor: const Color(0xFF0A0B10),
            useMaterial3: true,
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFF12131A),
              surfaceTintColor: Colors.transparent,
            ),
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF6366F1),
              secondary: Color(0xFFA855F7),
              surface: Color(0xFF12131A),
              error: Color(0xFFEF4444),
              onPrimary: Colors.white,
              onSecondary: Colors.white,
              onSurface: Colors.white,
            ),
          ),
          home: const SplashScreen(),
        );
      },
    );
  }
}
