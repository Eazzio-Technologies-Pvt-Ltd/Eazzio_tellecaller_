import 'dart:async';
import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Timing configuration (2 seconds splash time)
    Timer(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => ApiService.isAuthenticated
                ? const DashboardScreen()
                : const LoginScreen(),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(40.0),
          child: Image.asset(
            isDark ? 'assets/logo-dark.png' : 'assets/logo.png',
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}
