import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';
import 'package:eazzio_telecaller/screens/company_admin_dashboard_screen.dart';

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
    Timer(const Duration(seconds: 2), () async {
      if (mounted) {
        if (ApiService.isAuthenticated) {
          final prefs = await SharedPreferences.getInstance();
          final role = prefs.getString('user_role') ?? 'telecaller';
          if (mounted) {
            if (role == 'admin' || role == 'superadmin') {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => const CompanyAdminDashboardScreen()),
              );
            } else {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => const DashboardScreen()),
              );
            }
          }
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const LoginScreen()),
          );
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(40.0),
          child: Image.asset(
            'assets/logo.png',
            fit: BoxFit.contain,
          ),
        ),
      ),
    );
  }
}
