import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Shared Preferences and Auth configuration cache
  await ApiService.init();

  runApp(const EazzioApp());
}

class EazzioApp extends StatelessWidget {
  const EazzioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Eazzio Telecaller',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
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
      home: ApiService.isAuthenticated 
          ? const DashboardScreen() 
          : const LoginScreen(),
    );
  }
}
