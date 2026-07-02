import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';
import 'package:eazzio_telecaller/services/layout_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _companyRegController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;

  // Animation controller
  late AnimationController _animationController;
  
  // Sequenced Animation variables
  late Animation<double> _spinnerOpacity;
  late Animation<double> _bgTransition;
  late Animation<double> _cardOpacity;

  @override
  void initState() {
    super.initState();
    
    // Total animation timeline runs for 2.0 seconds
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );

    // 1. Initial splash representation (0.0s to 1.0s): Large logo, white background, circular loading spinner.
    
    // 2. Transition phase (1.0s to 1.4s): Fades out spinner.
    _spinnerOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.50, 0.70, curve: Curves.easeOut),
      ),
    );

    // Background transition from 1.0s to 1.5s
    _bgTransition = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.50, 0.75, curve: Curves.easeInOut),
      ),
    );

    // 3. Card, form elements, and footer fade in together from 1.4s to 2.0s
    _cardOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.70, 1.00, curve: Curves.easeOut),
      ),
    );

    // Play transition on screen load
    _animationController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _companyRegController.dispose();
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
      // Perform API authentication
      final result = await ApiService.login(
        _emailController.text.trim(),
        _companyRegController.text.trim(),
      );

      if (result['success'] == true) {
        if (result['user']['role'] != 'telecaller') {
          setState(() {
            _errorMessage = "Access Denied: Only telecallers can access this mobile app.";
            _isLoading = false;
          });
          await ApiService.logout();
          return;
        }

        // Start telemetry session immediately upon login
        TelemetryService().startSession();

        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const DashboardScreen()),
          );
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final labelColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280);
    final fieldFillColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);
    final bgColor = isDark ? const Color(0xFF0A0B10) : const Color(0xFFF3F4F6); // Soft grey background
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;

    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        final layout = ResponsiveLayout(context);
        final activeBgColor = Color.lerp(Colors.white, bgColor, _bgTransition.value)!;

        return Scaffold(
          backgroundColor: activeBgColor,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final double availableHeight = constraints.maxHeight;

                // Make the logo size responsive based on height to prevent overflows
                final double baseLogoSize = layout.scale(380.0 * 0.84, 450.0 * 0.84);
                final double currentLogoSize = availableHeight < 650 
                    ? availableHeight * 0.25 // Scales down logo on small viewports
                    : baseLogoSize;

                // Centered top margin during splash, slides up smoothly during transition
                final double computedSplashTopMargin = (availableHeight - currentLogoSize - 60) / 2.3;
                final double splashTopMargin = computedSplashTopMargin > 0 ? computedSplashTopMargin : 0.0;
                final double finalTopMargin = layout.scale(16.0, 28.0);
                
                final double currentTopMargin = splashTopMargin + (finalTopMargin - splashTopMargin) * _cardOpacity.value;

                return SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: availableHeight,
                    ),
                    child: IntrinsicHeight(
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Top margin (animated)
                            SizedBox(height: currentTopMargin),

                            // Logo and spinner area
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: layout.scale(24.0, 32.0)),
                              child: Column(
                                children: [
                                  Center(
                                    child: SizedBox(
                                      width: currentLogoSize,
                                      height: currentLogoSize,
                                      child: Image.asset(
                                        isDark ? 'assets/logo.png' : 'assets/logo_light.png',
                                        fit: BoxFit.contain,
                                      ),
                                    ),
                                  ),
                                  
                                  // Spinner showing initially, fading out
                                  if (_spinnerOpacity.value > 0.0) ...[
                                    SizedBox(height: layout.scale(24.0, 36.0) * _spinnerOpacity.value),
                                    Opacity(
                                      opacity: _spinnerOpacity.value,
                                      child: Center(
                                        child: SizedBox(
                                          width: layout.scale(24.0, 28.0),
                                          height: layout.scale(24.0, 28.0),
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            valueColor: AlwaysStoppedAnimation<Color>(
                                              Theme.of(context).primaryColor,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                  
                                  // Credentials subtitle under logo (fades in)
                                  if (_cardOpacity.value > 0.0) ...[
                                    Opacity(
                                      opacity: _cardOpacity.value,
                                      child: Column(
                                        children: [
                                          SizedBox(height: layout.scale(12.0, 16.0)),
                                          Text(
                                            'Enter your credentials to access your account',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              fontSize: layout.fontSizeBody,
                                              color: labelColor,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            
                            // Animated spacer that shrinks as card fades in
                            SizedBox(height: layout.scale(20.0, 32.0) * (1.0 - _cardOpacity.value)),

                            // Floating Form Card (separated from all edges: left, right, top, and down)
                            if (_cardOpacity.value > 0.0) ...[
                              Opacity(
                                opacity: _cardOpacity.value,
                                child: Container(
                                  width: double.infinity,
                                  margin: EdgeInsets.symmetric(
                                    horizontal: layout.scale(20.0, 28.0),
                                    vertical: layout.scale(12.0, 20.0),
                                  ),
                                  decoration: BoxDecoration(
                                    color: cardColor,
                                    borderRadius: BorderRadius.circular(24),
                                    border: isDark
                                        ? Border.all(color: const Color(0xFF222435), width: 1)
                                        : null,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(isDark ? 0.2 : 0.05),
                                        blurRadius: 16,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  padding: EdgeInsets.all(layout.scale(20.0, 28.0)),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Welcome Back 👋',
                                        style: TextStyle(
                                          fontSize: layout.fontSizeHeading + 6,
                                          fontWeight: FontWeight.bold,
                                          color: textColor,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'Sign in to continue',
                                        style: TextStyle(
                                          fontSize: layout.fontSizeBody,
                                          color: labelColor,
                                        ),
                                      ),
                                      const SizedBox(height: 28),
                                      
                                      // Error Display
                                      if (_errorMessage != null) ...[
                                        Container(
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: const Color(0x26EF4444),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: const Color(0x59EF4444)),
                                          ),
                                          child: Row(
                                            children: [
                                              const Icon(Icons.error_outline, color: Color(0xFFEF4444)),
                                              const SizedBox(width: 10),
                                              Expanded(
                                                child: Text(
                                                  _errorMessage!,
                                                  style: TextStyle(
                                                    color: isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626),
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(height: 20),
                                      ],

                                      // Field 1: Company Registration Code
                                      Text(
                                        'Company Registration Code',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: textColor,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      TextFormField(
                                        controller: _companyRegController,
                                        style: TextStyle(color: textColor),
                                        keyboardType: TextInputType.text,
                                        textCapitalization: TextCapitalization.characters,
                                        decoration: InputDecoration(
                                          hintText: 'e.g. EAZ-123456',
                                          hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                                          prefixIcon: Icon(Icons.business_sharp, color: labelColor),
                                          filled: true,
                                          fillColor: fieldFillColor,
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(16),
                                            borderSide: BorderSide.none,
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(16),
                                            borderSide: BorderSide.none,
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(16),
                                            borderSide: BorderSide(
                                              color: Theme.of(context).primaryColor,
                                              width: 1.5,
                                            ),
                                          ),
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
                                      
                                      const SizedBox(height: 20),

                                      // Field 2: Registered Mobile Number
                                      Text(
                                        'Registered Mobile Number',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: textColor,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      TextFormField(
                                        controller: _emailController,
                                        style: TextStyle(color: textColor),
                                        keyboardType: TextInputType.phone,
                                        decoration: InputDecoration(
                                          hintText: 'e.g. 9876543210',
                                          hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                                          prefixIcon: Icon(Icons.phone, color: labelColor),
                                          filled: true,
                                          fillColor: fieldFillColor,
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(16),
                                            borderSide: BorderSide.none,
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(16),
                                            borderSide: BorderSide.none,
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(16),
                                            borderSide: BorderSide(
                                              color: Theme.of(context).primaryColor,
                                              width: 1.5,
                                            ),
                                          ),
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
                                      
                                      SizedBox(height: layout.spacing),

                                      // Access Button
                                      SizedBox(
                                        width: double.infinity,
                                        child: ElevatedButton(
                                          onPressed: _isLoading ? null : _handleLogin,
                                          style: ElevatedButton.styleFrom(
                                            padding: EdgeInsets.symmetric(vertical: layout.scale(14.0, 18.0)),
                                            backgroundColor: Theme.of(context).primaryColor,
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(16),
                                            ),
                                            elevation: 0,
                                          ),
                                          child: _isLoading
                                              ? const SizedBox(
                                                  height: 20,
                                                  width: 20,
                                                  child: CircularProgressIndicator(
                                                    color: Colors.white,
                                                    strokeWidth: 2,
                                                  ),
                                                )
                                              : Text(
                                                  'Access Dialer Workspace',
                                                  style: TextStyle(
                                                    fontSize: layout.fontSizeHeading,
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
                              
                              SizedBox(height: layout.scale(16.0, 32.0)),

                              // Branded Footer outside the card (centered)
                              Opacity(
                                opacity: _cardOpacity.value,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      'Made with ',
                                      style: TextStyle(
                                        color: labelColor,
                                        fontSize: layout.fontSizeCaption,
                                      ),
                                    ),
                                    Icon(
                                      Icons.favorite,
                                      color: Colors.red,
                                      size: layout.scale(12.0, 14.0),
                                    ),
                                    Text(
                                      ' by Eazzio Technologies Pvt Ltd',
                                      style: TextStyle(
                                        color: labelColor,
                                        fontSize: layout.fontSizeCaption,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(height: layout.scale(16.0, 32.0)),
                            ],
                          ],
                        ),
                      ),
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
