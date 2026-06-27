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
  
  late Animation<double> _field1Opacity;
  late Animation<Offset> _field1Slide;
  
  late Animation<double> _field2Opacity;
  late Animation<Offset> _field2Slide;
  
  late Animation<double> _buttonOpacity;
  late Animation<Offset> _buttonSlide;
  
  late Animation<double> _footerOpacity;

  @override
  void initState() {
    super.initState();
    
    // Total animation timeline runs for 4.0 seconds for a majestic choreographed look
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    );

    // 1. Initial splash representation (0.0s to 1.2s): Large logo, white background, circular loading spinner.
    
    // 2. Transition phase (1.2s to 2.0s): Fades out spinner, compresses logo to end size, background shifts.
    _spinnerOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.30, 0.42, curve: Curves.easeOut),
      ),
    );



    _bgTransition = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.30, 0.50, curve: Curves.easeInOut),
      ),
    );

    // 3. Card background & subtitle text phase (2.0s to 2.4s)
    _cardOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.50, 0.60, curve: Curves.easeOut),
      ),
    );

    // 4. First Input Field: Company Registration Code (2.4s to 2.8s)
    _field1Opacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.60, 0.70, curve: Curves.easeOut),
      ),
    );
    _field1Slide = Tween<Offset>(begin: const Offset(0.0, 0.25), end: Offset.zero).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.60, 0.70, curve: Curves.easeOutCubic),
      ),
    );

    // 5. Second Input Field: Registered Mobile Number (2.8s to 3.2s)
    _field2Opacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.70, 0.80, curve: Curves.easeOut),
      ),
    );
    _field2Slide = Tween<Offset>(begin: const Offset(0.0, 0.25), end: Offset.zero).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.70, 0.80, curve: Curves.easeOutCubic),
      ),
    );

    // 6. Access Button: Access Dialer Workspace (3.2s to 3.6s)
    _buttonOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.80, 0.90, curve: Curves.easeOut),
      ),
    );
    _buttonSlide = Tween<Offset>(begin: const Offset(0.0, 0.25), end: Offset.zero).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.80, 0.90, curve: Curves.easeOutCubic),
      ),
    );

    // 7. Branded Footer: Made with ❤️ by Eazzio Technologies Pvt Ltd (3.6s to 4.0s)
    _footerOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.90, 1.00, curve: Curves.easeOut),
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
    final labelColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final fieldFillColor = isDark ? const Color(0xFF12131A) : const Color(0xFFF3F4F6);
    final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);

    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        final layout = ResponsiveLayout(context);
        final activeBgColor = Color.lerp(Colors.white, bgColor, _bgTransition.value)!;

        // Responsive start logo width (84% of viewport width clamped between 380px and 450px)
        final double startLogoWidth = layout.scale(380.0 * 0.84, 450.0 * 0.84);
        // Responsive end logo width (58% of viewport width clamped between 380px and 450px)
        final double endLogoWidth = layout.scale(380.0 * 0.58, 450.0 * 0.58);

        final double currentCurveVal = const Interval(0.30, 0.50, curve: Curves.easeInOutCubic).transform(_animationController.value);
        final double currentLogoSize = startLogoWidth + (endLogoWidth - startLogoWidth) * currentCurveVal;

        return Scaffold(
          backgroundColor: activeBgColor,
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(
                  horizontal: layout.scale(20.0, 28.0),
                  vertical: layout.scale(16.0, 20.0),
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Animated Logo Container
                      Center(
                        child: SizedBox(
                          width: currentLogoSize,
                          height: currentLogoSize, // maintain square aspect ratio for tall headphones branding icon
                          child: Image.asset(
                            isDark ? 'assets/logo.png' : 'assets/logo_light.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                      
                      // Spinner showing initially, fading out
                      if (_spinnerOpacity.value > 0.0) ...[
                        SizedBox(height: layout.scale(32.0, 48.0) * _spinnerOpacity.value),
                        Opacity(
                          opacity: _spinnerOpacity.value,
                          child: Center(
                            child: SizedBox(
                              width: layout.scale(24.0, 28.0),
                              height: layout.scale(24.0, 28.0),
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  isDark ? const Color(0xFF6366F1) : const Color(0xFF0077B6),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],

                      // Card elements phase (card background & subtitle)
                      if (_cardOpacity.value > 0.0) ...[
                        Opacity(
                          opacity: _cardOpacity.value,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SizedBox(height: layout.scale(8.0, 12.0)),
                              Text(
                                'SIM-Based Automated Outbound Calls',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: layout.fontSizeBody - 1,
                                  color: labelColor,
                                ),
                              ),
                              SizedBox(height: layout.scale(20.0, 30.0)),
                              
                              // Main Form Card Container
                              Container(
                                padding: EdgeInsets.all(layout.scale(16.0, 24.0)),
                                decoration: BoxDecoration(
                                  color: cardColor,
                                  borderRadius: BorderRadius.circular(layout.cardRadius),
                                  border: Border.all(
                                    color: isDark ? borderColor : const Color(0xFF6366F1).withOpacity(0.3),
                                    width: isDark ? 1 : 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF6366F1).withOpacity(isDark ? 0.03 : 0.05),
                                      blurRadius: isDark ? 4 : 6,
                                      offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
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
                                                style: const TextStyle(color: Color(0xFFF87171), fontSize: 13),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 20),
                                    ],

                                    // Field 1: Company Registration Code
                                    if (_field1Opacity.value > 0.0) ...[
                                      Opacity(
                                        opacity: _field1Opacity.value,
                                        child: FractionalTranslation(
                                          translation: _field1Slide.value,
                                          child: TextFormField(
                                            controller: _companyRegController,
                                            style: TextStyle(color: textColor),
                                            keyboardType: TextInputType.text,
                                            textCapitalization: TextCapitalization.characters,
                                            decoration: InputDecoration(
                                              labelText: 'Company Registration Code',
                                              labelStyle: TextStyle(color: labelColor),
                                              hintText: 'e.g. EAZ-123456',
                                              hintStyle: const TextStyle(color: Color(0xFF4B5563)),
                                              prefixIcon: Icon(Icons.business_sharp, color: labelColor),
                                              filled: true,
                                              fillColor: fieldFillColor,
                                              border: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                borderSide: BorderSide(
                                                  color: isDark ? borderColor : const Color(0xFFCBD5E1),
                                                  width: 1,
                                                ),
                                              ),
                                              enabledBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                borderSide: BorderSide(
                                                  color: isDark ? borderColor : const Color(0xFFCBD5E1),
                                                  width: 1,
                                                ),
                                              ),
                                              focusedBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
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
                                        ),
                                      ),
                                    ],
                                    
                                    // Spacer before Field 2
                                    if (_field2Opacity.value > 0.0) const SizedBox(height: 20),

                                    // Field 2: Registered Mobile Number
                                    if (_field2Opacity.value > 0.0) ...[
                                      Opacity(
                                        opacity: _field2Opacity.value,
                                        child: FractionalTranslation(
                                          translation: _field2Slide.value,
                                          child: TextFormField(
                                            controller: _emailController,
                                            style: TextStyle(color: textColor),
                                            keyboardType: TextInputType.phone,
                                            decoration: InputDecoration(
                                              labelText: 'Registered Mobile Number',
                                              labelStyle: TextStyle(color: labelColor),
                                              hintText: 'e.g. 9876543210',
                                              hintStyle: const TextStyle(color: Color(0xFF4B5563)),
                                              prefixIcon: Icon(Icons.phone, color: labelColor),
                                              filled: true,
                                              fillColor: fieldFillColor,
                                              border: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                borderSide: BorderSide(
                                                  color: isDark ? borderColor : const Color(0xFFCBD5E1),
                                                  width: 1,
                                                ),
                                              ),
                                              enabledBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                borderSide: BorderSide(
                                                  color: isDark ? borderColor : const Color(0xFFCBD5E1),
                                                  width: 1,
                                                ),
                                              ),
                                              focusedBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
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
                                        ),
                                      ),
                                    ],
                                    
                                    // Spacer before Access Button
                                    if (_buttonOpacity.value > 0.0) SizedBox(height: layout.spacing),

                                    // Access Button: Access Dialer Workspace
                                    if (_buttonOpacity.value > 0.0) ...[
                                      Opacity(
                                        opacity: _buttonOpacity.value,
                                        child: FractionalTranslation(
                                          translation: _buttonSlide.value,
                                          child: ElevatedButton(
                                            onPressed: _isLoading ? null : _handleLogin,
                                            style: ElevatedButton.styleFrom(
                                              padding: EdgeInsets.symmetric(vertical: layout.scale(12.0, 16.0)),
                                              backgroundColor: const Color(0xFF6366F1),
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(layout.scale(10.0, 12.0)),
                                              ),
                                              elevation: 4,
                                              shadowColor: const Color(0x4D6366F1),
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
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Branded Footer (Made with ❤️ by Eazzio Technologies Pvt Ltd)
                      if (_footerOpacity.value > 0.0) ...[
                        SizedBox(height: layout.scale(24.0, 48.0)),
                        Opacity(
                          opacity: _footerOpacity.value,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Made with ',
                                style: TextStyle(color: labelColor, fontSize: layout.fontSizeCaption),
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
                      ],

                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
