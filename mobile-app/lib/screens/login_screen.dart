import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';
import 'package:eazzio_telecaller/screens/company_admin_dashboard_screen.dart';
import 'package:eazzio_telecaller/services/layout_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _companyRegController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _isAdminMode = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  late AnimationController _animationController;
  late Animation<double> _spinnerOpacity;
  late Animation<double> _bgTransition;
  late Animation<double> _cardOpacity;
  late Animation<double> _logoMove;

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    );

    // Spinner fades out (1.2s → 1.5s)
    _spinnerOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.46, 0.58, curve: Curves.easeOut),
      ),
    );

    // Background fades from white → themed (1.4s → 1.9s)
    _bgTransition = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.54, 0.73, curve: Curves.easeInOut),
      ),
    );

    // Logo moves slowly from center → top (1.5s → 2.1s)
    _logoMove = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.58, 0.81, curve: Curves.easeInOutCubic),
      ),
    );

    // Form card fades in after logo finishes (2.1s → 2.6s)
    _cardOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.81, 1.00, curve: Curves.easeOut),
      ),
    );

    _animationController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _phoneController.dispose();
    _companyRegController.dispose();
    _passwordController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = _isAdminMode
          ? await ApiService.login(
              email: _emailController.text.trim(),
              password: _passwordController.text,
            )
          : await ApiService.login(
              email: _phoneController.text.trim(),
              companyRegNum: _companyRegController.text.trim(),
            );

      if (result['success'] == true) {
        final role = result['user']['role'];
        if (_isAdminMode) {
          if (role != 'admin' && role != 'superadmin') {
            setState(() {
              _errorMessage = "Access Denied: Only administrators can access this section.";
              _isLoading = false;
            });
            await ApiService.logout();
            return;
          }
        } else {
          if (role != 'telecaller') {
            setState(() {
              _errorMessage = "Access Denied: Only telecallers can access this mobile app.";
              _isLoading = false;
            });
            await ApiService.logout();
            return;
          }
        }

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_role', role);

        if (role == 'telecaller') {
          TelemetryService().startSession();
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const DashboardScreen()),
            );
          }
        } else {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const CompanyAdminDashboardScreen()),
            );
          }
        }
      } else {
        setState(() {
          _errorMessage = result['error'] ?? 'Login failed. Please check credentials.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'An error occurred: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _showForgotPasswordDialog() async {
    final emailController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool isDialogLoading = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
        final textColor = isDark ? Colors.white : const Color(0xFF111827);
        final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
        final fieldFillColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);
        final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: cardColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Text(
                'Reset Admin Password',
                style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 20),
              ),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Enter your registered admin email address. We will send you a 6-digit OTP code to verify your identity.',
                      style: TextStyle(color: subtextColor, fontSize: 13, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: TextStyle(color: textColor, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Admin Email',
                        labelStyle: TextStyle(color: subtextColor, fontSize: 13),
                        prefixIcon: Icon(Icons.email_outlined, color: subtextColor, size: 20),
                        filled: true,
                        fillColor: fieldFillColor,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter your email';
                        }
                        if (!value.contains('@')) {
                          return 'Please enter a valid email';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isDialogLoading ? null : () => Navigator.pop(context),
                  child: Text('Cancel', style: TextStyle(color: subtextColor)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: isDialogLoading
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          
                          setDialogState(() {
                            isDialogLoading = true;
                          });

                          final email = emailController.text.trim();
                          final res = await ApiService.forgotPassword(email);

                          if (res['success'] == true) {
                            if (context.mounted) {
                              Navigator.pop(context); // Close email dialog
                              _showResetPasswordDialog(email); // Open reset password dialog
                            }
                          } else {
                            setDialogState(() {
                              isDialogLoading = false;
                            });
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(res['error'] ?? 'Failed to send OTP.'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                  child: isDialogLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Send OTP', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showResetPasswordDialog(String email) async {
    final otpController = TextEditingController();
    final passwordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool isDialogLoading = false;
    bool obscurePassword = true;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
        final textColor = isDark ? Colors.white : const Color(0xFF111827);
        final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
        final fieldFillColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);
        final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: cardColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Text(
                'Enter OTP & New Password',
                style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 20),
              ),
              content: SingleChildScrollView(
                child: Form(
                  key: formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'A 6-digit OTP code has been sent to $email. Enter the code and set your new password.',
                        style: TextStyle(color: subtextColor, fontSize: 13, height: 1.4),
                      ),
                      const SizedBox(height: 16),
                      
                      // OTP Field
                      TextFormField(
                        controller: otpController,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        style: TextStyle(color: textColor, fontSize: 14),
                        decoration: InputDecoration(
                          labelText: '6-Digit OTP Code',
                          labelStyle: TextStyle(color: subtextColor, fontSize: 13),
                          prefixIcon: Icon(Icons.security_outlined, color: subtextColor, size: 20),
                          filled: true,
                          fillColor: fieldFillColor,
                          counterText: '',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                          ),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().length != 6) {
                            return 'Please enter 6-digit OTP code';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),

                      // New Password Field
                      TextFormField(
                        controller: passwordController,
                        obscureText: obscurePassword,
                        style: TextStyle(color: textColor, fontSize: 14),
                        decoration: InputDecoration(
                          labelText: 'New Password',
                          labelStyle: TextStyle(color: subtextColor, fontSize: 13),
                          prefixIcon: Icon(Icons.lock_outline, color: subtextColor, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              obscurePassword ? Icons.visibility_off : Icons.visibility,
                              color: subtextColor,
                              size: 20,
                            ),
                            onPressed: () {
                              setDialogState(() {
                                obscurePassword = !obscurePassword;
                              });
                            },
                          ),
                          filled: true,
                          fillColor: fieldFillColor,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                          ),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().length < 6) {
                            return 'Password must be at least 6 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),

                      // Confirm Password Field
                      TextFormField(
                        controller: confirmPasswordController,
                        obscureText: obscurePassword,
                        style: TextStyle(color: textColor, fontSize: 14),
                        decoration: InputDecoration(
                          labelText: 'Confirm New Password',
                          labelStyle: TextStyle(color: subtextColor, fontSize: 13),
                          prefixIcon: Icon(Icons.lock_outline, color: subtextColor, size: 20),
                          filled: true,
                          fillColor: fieldFillColor,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                          ),
                        ),
                        validator: (value) {
                          if (value == null || value != passwordController.text) {
                            return 'Passwords do not match';
                          }
                          return null;
                        },
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isDialogLoading ? null : () => Navigator.pop(context),
                  child: Text('Cancel', style: TextStyle(color: subtextColor)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: isDialogLoading
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          
                          setDialogState(() {
                            isDialogLoading = true;
                          });

                          final res = await ApiService.resetPassword(
                            email: email,
                            otp: otpController.text.trim(),
                            newPassword: passwordController.text.trim(),
                          );

                          if (res['success'] == true) {
                            if (context.mounted) {
                              Navigator.pop(context); // Close reset dialog
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(res['message'] ?? 'Password reset successfully.'),
                                  backgroundColor: Colors.green,
                                ),
                              );
                            }
                          } else {
                            setDialogState(() {
                              isDialogLoading = false;
                            });
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(res['error'] ?? 'Failed to reset password.'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                  child: isDialogLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Reset Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final labelColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280);
    final fieldFillColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);
    final bgColor = isDark ? const Color(0xFF0A0B10) : const Color(0xFFF3F4F6);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);

    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        final layout = ResponsiveLayout(context);
        final activeBgColor = Color.lerp(Colors.white, bgColor, _bgTransition.value)!;

        return Scaffold(
          backgroundColor: activeBgColor,
          resizeToAvoidBottomInset: false,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final double availableHeight = constraints.maxHeight;

                // Dynamically scale logo size down from splash to login mode to fit all screen sizes compactly
                final double splashLogoSize = (availableHeight * 0.50).clamp(260.0, 380.0);
                final double loginLogoSize = (availableHeight * 0.36).clamp(180.0, 245.0);
                final double logoSize = splashLogoSize + (loginLogoSize - splashLogoSize) * _logoMove.value;

                // Splash: logo vertically centered. Login: logo at top with small margin.
                final double finalTopMargin = layout.scale(12.0, 18.0);
                final double splashTopMargin = ((availableHeight - splashLogoSize) / 2.0 - layout.scale(24.0, 36.0)).clamp(finalTopMargin, availableHeight * 0.32);
                // Interpolate from splash center position → top
                final double currentTopMargin = splashTopMargin + (finalTopMargin - splashTopMargin) * _logoMove.value;

                return Padding(
                  padding: EdgeInsets.symmetric(horizontal: layout.scale(14.0, 20.0)),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Animated spacer — centers logo on splash, shrinks after
                        SizedBox(height: currentTopMargin),

                        // Big logo — same size throughout, only position changes
                        Center(
                          child: SizedBox(
                            width: logoSize,
                            height: logoSize,
                            child: Image.asset(
                              isDark ? 'assets/logo.png' : 'assets/logo_light.png',
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),

                        // Spinner (splash only, fades out)
                        if (_spinnerOpacity.value > 0.0) ...[
                          SizedBox(height: layout.scale(12.0, 18.0) * _spinnerOpacity.value),
                          Opacity(
                            opacity: _spinnerOpacity.value,
                            child: Center(
                              child: SizedBox(
                                width: layout.scale(20.0, 24.0),
                                height: layout.scale(20.0, 24.0),
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.0,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Theme.of(context).primaryColor,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],

                        // ── Form Card — Compact ──
                        if (_cardOpacity.value > 0.0) ...[
                          SizedBox(height: layout.scale(4.0, 8.0)),
                          Opacity(
                            opacity: _cardOpacity.value,
                            child: Container(
                              margin: EdgeInsets.only(bottom: layout.scale(4.0, 8.0)),
                                decoration: BoxDecoration(
                                  color: cardColor,
                                  borderRadius: BorderRadius.circular(layout.scale(16.0, 20.0)),
                                  border: Border.all(
                                    color: isDark ? borderColor : const Color(0xFF6366F1).withOpacity(0.3),
                                    width: isDark ? 1 : 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF6366F1).withOpacity(isDark ? 0.03 : 0.06),
                                      blurRadius: isDark ? 4 : 8,
                                      offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                padding: EdgeInsets.symmetric(
                                  horizontal: layout.scale(18.0, 22.0),
                                  vertical: layout.scale(18.0, 22.0),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // ── Header ──
                                    Text(
                                      'Welcome Back',
                                      style: TextStyle(
                                        fontSize: layout.scale(20.0, 24.0),
                                        fontWeight: FontWeight.bold,
                                        color: textColor,
                                      ),
                                    ),
                                    SizedBox(height: layout.scale(4.0, 6.0)),
                                    Text(
                                      'Sign in to continue',
                                      style: TextStyle(
                                        fontSize: layout.scale(13.0, 15.0),
                                        color: labelColor,
                                      ),
                                    ),

                                    // Spacing before toggle
                                    SizedBox(height: layout.scale(12.0, 16.0)),

                                    // Tab toggle between Telecaller and Company Admin
                                    Container(
                                      decoration: BoxDecoration(
                                        color: fieldFillColor,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: GestureDetector(
                                              onTap: () {
                                                setState(() {
                                                  _isAdminMode = false;
                                                  _errorMessage = null;
                                                });
                                              },
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(vertical: 10),
                                                decoration: BoxDecoration(
                                                  color: !_isAdminMode ? Theme.of(context).primaryColor : Colors.transparent,
                                                  borderRadius: BorderRadius.circular(10),
                                                ),
                                                alignment: Alignment.center,
                                                child: Text(
                                                  'Telecaller',
                                                  style: TextStyle(
                                                    color: !_isAdminMode ? Colors.white : labelColor,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: layout.scale(12.0, 14.0),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                          Expanded(
                                            child: GestureDetector(
                                              onTap: () {
                                                setState(() {
                                                  _isAdminMode = true;
                                                  _errorMessage = null;
                                                });
                                              },
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(vertical: 10),
                                                decoration: BoxDecoration(
                                                  color: _isAdminMode ? Theme.of(context).primaryColor : Colors.transparent,
                                                  borderRadius: BorderRadius.circular(10),
                                                ),
                                                alignment: Alignment.center,
                                                child: Text(
                                                  'Company Admin',
                                                  style: TextStyle(
                                                    color: _isAdminMode ? Colors.white : labelColor,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: layout.scale(12.0, 14.0),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),

                                    // Error Banner
                                    if (_errorMessage != null) ...[
                                      SizedBox(height: layout.scale(10.0, 14.0)),
                                      Container(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: layout.scale(10.0, 12.0),
                                          vertical: layout.scale(8.0, 10.0),
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(0x26EF4444),
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(color: const Color(0x59EF4444)),
                                        ),
                                        child: Row(
                                          children: [
                                            Icon(Icons.error_outline, color: const Color(0xFFEF4444), size: layout.scale(15.0, 18.0)),
                                            SizedBox(width: layout.scale(8.0, 10.0)),
                                            Expanded(
                                              child: Text(
                                                _errorMessage!,
                                                style: TextStyle(
                                                  color: isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626),
                                                  fontSize: layout.scale(11.0, 13.0),
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],

                                    // Spacer
                                    SizedBox(height: layout.scale(12.0, 16.0)),

                                    if (!_isAdminMode) ...[
                                      // ── Field 1: Company Registration Code ──
                                      TextFormField(
                                        controller: _companyRegController,
                                        style: TextStyle(color: textColor, fontSize: layout.scale(14.0, 16.0)),
                                        keyboardType: TextInputType.text,
                                        textCapitalization: TextCapitalization.characters,
                                        decoration: InputDecoration(
                                          labelText: 'Company Registration Code',
                                          labelStyle: TextStyle(color: labelColor, fontSize: layout.scale(13.0, 15.0)),
                                          hintText: 'e.g. EAZ-123456',
                                          hintStyle: TextStyle(color: const Color(0xFF9CA3AF), fontSize: layout.scale(11.0, 13.0)),
                                          prefixIcon: Icon(Icons.business_sharp, color: labelColor, size: layout.scale(20.0, 24.0)),
                                          filled: true,
                                          fillColor: fieldFillColor,
                                          isDense: false,
                                          contentPadding: EdgeInsets.symmetric(
                                            horizontal: layout.scale(14.0, 16.0),
                                            vertical: layout.scale(16.0, 18.0),
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                                          ),
                                        ),
                                        validator: (value) {
                                          if (value == null || value.trim().isEmpty) {
                                            return 'Please enter Company Registration Code';
                                          }
                                          if (!value.trim().toUpperCase().startsWith('EAZ-')) {
                                            return 'Must start with EAZ- Prefix';
                                          }
                                          return null;
                                        },
                                      ),

                                      // Spacing between registration and mobile number fields
                                      SizedBox(height: layout.scale(12.0, 16.0)),

                                      // ── Field 2: Registered Mobile Number ──
                                      TextFormField(
                                        controller: _phoneController,
                                        style: TextStyle(color: textColor, fontSize: layout.scale(14.0, 16.0)),
                                        key: const ValueKey('phone_field'),
                                        keyboardType: TextInputType.phone,
                                        decoration: InputDecoration(
                                          labelText: 'Registered Mobile Number',
                                          labelStyle: TextStyle(color: labelColor, fontSize: layout.scale(13.0, 15.0)),
                                          hintText: 'e.g. 9876543210',
                                          hintStyle: TextStyle(color: const Color(0xFF9CA3AF), fontSize: layout.scale(11.0, 13.0)),
                                          prefixIcon: Icon(Icons.phone, color: labelColor, size: layout.scale(20.0, 24.0)),
                                          filled: true,
                                          fillColor: fieldFillColor,
                                          isDense: false,
                                          contentPadding: EdgeInsets.symmetric(
                                            horizontal: layout.scale(14.0, 16.0),
                                            vertical: layout.scale(16.0, 18.0),
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                                          ),
                                        ),
                                        validator: (value) {
                                          if (value == null || value.trim().isEmpty) {
                                            return 'Please enter your registered mobile number';
                                          }
                                          if (value.trim().length < 8) {
                                            return 'Please enter a valid mobile number';
                                          }
                                          return null;
                                        },
                                      ),
                                    ] else ...[
                                      // ── Field 1: Admin Email ──
                                      TextFormField(
                                        controller: _emailController,
                                        style: TextStyle(color: textColor, fontSize: layout.scale(14.0, 16.0)),
                                        key: const ValueKey('email_field'),
                                        keyboardType: TextInputType.emailAddress,
                                        decoration: InputDecoration(
                                          labelText: 'Admin Email',
                                          labelStyle: TextStyle(color: labelColor, fontSize: layout.scale(13.0, 15.0)),
                                          hintText: 'e.g. admin@company.com',
                                          hintStyle: TextStyle(color: const Color(0xFF9CA3AF), fontSize: layout.scale(11.0, 13.0)),
                                          prefixIcon: Icon(Icons.email, color: labelColor, size: layout.scale(20.0, 24.0)),
                                          filled: true,
                                          fillColor: fieldFillColor,
                                          isDense: false,
                                          contentPadding: EdgeInsets.symmetric(
                                            horizontal: layout.scale(14.0, 16.0),
                                            vertical: layout.scale(16.0, 18.0),
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                                          ),
                                        ),
                                        validator: (value) {
                                          if (value == null || value.trim().isEmpty) {
                                            return 'Please enter registered email';
                                          }
                                          if (!value.contains('@')) {
                                            return 'Please enter a valid email address';
                                          }
                                          return null;
                                        },
                                      ),

                                      // Spacing between email and password
                                      SizedBox(height: layout.scale(12.0, 16.0)),

                                      // ── Field 2: Admin Password ──
                                      TextFormField(
                                        controller: _passwordController,
                                        style: TextStyle(color: textColor, fontSize: layout.scale(14.0, 16.0)),
                                        obscureText: _obscurePassword,
                                        decoration: InputDecoration(
                                          labelText: 'Password',
                                          labelStyle: TextStyle(color: labelColor, fontSize: layout.scale(13.0, 15.0)),
                                          prefixIcon: Icon(Icons.lock, color: labelColor, size: layout.scale(20.0, 24.0)),
                                          suffixIcon: IconButton(
                                            icon: Icon(
                                              _obscurePassword ? Icons.visibility : Icons.visibility_off,
                                              color: labelColor,
                                              size: layout.scale(20.0, 24.0),
                                            ),
                                            onPressed: () {
                                              setState(() {
                                                _obscurePassword = !_obscurePassword;
                                              });
                                            },
                                          ),
                                          filled: true,
                                          fillColor: fieldFillColor,
                                          isDense: false,
                                          contentPadding: EdgeInsets.symmetric(
                                            horizontal: layout.scale(14.0, 16.0),
                                            vertical: layout.scale(16.0, 18.0),
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: isDark ? borderColor : const Color(0xFFCBD5E1), width: 1),
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                                          ),
                                        ),
                                        validator: (value) {
                                          if (value == null || value.trim().isEmpty) {
                                            return 'Please enter your password';
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 6),
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: TextButton(
                                          onPressed: _showForgotPasswordDialog,
                                          style: TextButton.styleFrom(
                                            padding: EdgeInsets.zero,
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                          child: Text(
                                            'Forgot Password?',
                                            style: TextStyle(
                                              fontSize: layout.scale(12.0, 13.0),
                                              fontWeight: FontWeight.bold,
                                              color: Theme.of(context).primaryColor,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],

                                    // Spacer before button
                                    SizedBox(height: layout.scale(16.0, 20.0)),

                                    // ── Access Button ──
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton(
                                        onPressed: _isLoading ? null : _handleLogin,
                                        style: ElevatedButton.styleFrom(
                                          padding: EdgeInsets.symmetric(vertical: layout.scale(16.0, 18.0)),
                                          backgroundColor: Theme.of(context).primaryColor,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          elevation: 0,
                                        ),
                                        child: _isLoading
                                            ? SizedBox(
                                                height: layout.scale(18.0, 20.0),
                                                width: layout.scale(18.0, 20.0),
                                                child: const CircularProgressIndicator(
                                                  color: Colors.white,
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : Text(
                                                _isAdminMode ? 'Access Admin Dashboard' : 'Access Dialer Workspace',
                                                style: TextStyle(
                                                  fontSize: layout.scale(14.0, 17.0),
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          const Spacer(),
                        ] else ...[
                          const Spacer(),
                        ],

                        // Footer — bigger text
                        if (_cardOpacity.value > 0.0) ...[
                          Opacity(
                            opacity: _cardOpacity.value,
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: layout.scale(6.0, 10.0)),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      'Made with ',
                                      style: TextStyle(color: labelColor, fontSize: layout.scale(11.0, 13.0)),
                                    ),
                                    Icon(Icons.favorite, color: Colors.red, size: layout.scale(12.0, 14.0)),
                                    Text(
                                      ' by Eazzio Technologies Pvt Ltd',
                                      style: TextStyle(
                                        color: labelColor,
                                        fontSize: layout.scale(11.0, 13.0),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}
