import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';
import 'package:eazzio_telecaller/screens/dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
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
        '', // Password not required for telecallers
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

  void _showServerSettingsDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final labelColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final urlController = TextEditingController(text: ApiService.baseUrl);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            'Server Settings',
            style: TextStyle(color: textColor, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Enter the backend server URL:',
                style: TextStyle(fontSize: 13, color: labelColor),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: urlController,
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'e.g. http://192.168.1.100:5000',
                  hintStyle: const TextStyle(color: Color(0xFF4B5563)),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF1A1B24) : const Color(0xFFF3F4F6),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                      color: isDark ? const Color(0xFF222435) : const Color(0xFFCBD5E1),
                      width: 1,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(
                      color: isDark ? const Color(0xFF222435) : const Color(0xFFCBD5E1),
                      width: 1,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Loaded from assets/.env',
                style: TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 2),
              Text(
                'Current URL: ${ApiService.baseUrl}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF6366F1)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel', style: TextStyle(color: labelColor)),
            ),
            TextButton(
              onPressed: () async {
                // Clear manual override so app uses the auto-synced assets/.env URL
                await ApiService.clearServerUrlOverride();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Reset — using auto-synced URL from assets/.env'),
                      backgroundColor: Color(0xFF374151),
                    ),
                  );
                  Navigator.pop(context);
                }
              },
              child: const Text('Reset', style: TextStyle(color: Color(0xFFEF4444))),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () async {
                String newUrl = urlController.text.trim();
                if (newUrl.isNotEmpty) {
                  await ApiService.setServerUrl(newUrl);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Server URL updated to: $newUrl'),
                        backgroundColor: const Color(0xFF10B981),
                      ),
                    );
                    Navigator.pop(context);
                  }
                }
              },
              child: const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
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

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.settings, color: labelColor),
            tooltip: 'Server Settings',
            onPressed: _showServerSettingsDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo
                  Center(
                    child: SizedBox(
                      height: 250,
                      child: Image.asset(
                        isDark ? 'assets/logo-dark.png' : 'assets/logo.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'SIM-Based Automated Outbound Calls',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: labelColor,
                    ),
                  ),
                  const SizedBox(height: 30),

                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? borderColor : const Color(0xFF6366F1).withOpacity(0.3), width: isDark ? 1 : 2),
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

                        // Mobile Number Field
                        TextFormField(
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
                                color: isDark ? const Color(0xFF222435) : const Color(0xFFCBD5E1),
                                width: 1,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(
                                color: isDark ? const Color(0xFF222435) : const Color(0xFFCBD5E1),
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
                        const SizedBox(height: 24),

                        // Submit Button
                        ElevatedButton(
                          onPressed: _isLoading ? null : _handleLogin,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            backgroundColor: const Color(0xFF6366F1),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
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
                              : const Text(
                                  'Access Dialer Workspace',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
