import 'dart:async';
import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';
import 'package:eazzio_telecaller/services/layout_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    if (ApiService.isAuthenticated) {
      Timer(const Duration(milliseconds: 1000), () {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const DashboardScreen()),
          );
        }
      });
    } else {
      // Instantly go to LoginScreen which plays the splash-to-login transition animation
      Future.microtask(() {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, secondaryAnimation) => const LoginScreen(),
              transitionDuration: Duration.zero,
              reverseTransitionDuration: Duration.zero,
            ),
          );
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final layout = ResponsiveLayout(context);
    final double logoWidth = layout.scale(380.0 * 0.84, 450.0 * 0.84);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/logo_light.png',
              width: logoWidth,
              fit: BoxFit.contain,
            ),
            SizedBox(height: layout.scale(32.0, 48.0)),
            SizedBox(
              width: layout.scale(24.0, 28.0),
              height: layout.scale(24.0, 28.0),
              child: const CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0077B6)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
