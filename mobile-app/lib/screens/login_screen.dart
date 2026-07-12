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

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _companyRegController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _isAdminMode = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  // 'splash' | 'roleSelect' | 'loginForm'
  String _phase = 'splash';

  late AnimationController _splashCtrl;
  late AnimationController _roleCtrl;
  late AnimationController _formCtrl;
  late Animation<double> _spinnerOpacity;
  late Animation<double> _roleOpacity;
  late Animation<double> _formSlide;
  late Animation<double> _formOpacity;

  @override
  void initState() {
    super.initState();
    _companyRegController.text = 'EAZ-';
    _companyRegController.addListener(() {
      if (!_companyRegController.text.startsWith('EAZ-')) {
        _companyRegController.value = const TextEditingValue(
          text: 'EAZ-', selection: TextSelection.collapsed(offset: 4));
      }
    });
    _splashCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));
    _roleCtrl   = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
    _formCtrl   = AnimationController(vsync: this, duration: const Duration(milliseconds: 350));
    _spinnerOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _splashCtrl, curve: const Interval(0.55, 0.85, curve: Curves.easeOut)));
    _roleOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _roleCtrl, curve: Curves.easeOut));
    _formSlide = Tween<double>(begin: 50.0, end: 0.0).animate(
      CurvedAnimation(parent: _formCtrl, curve: Curves.easeOutCubic));
    _formOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _formCtrl, curve: Curves.easeOut));
    _splashCtrl.forward().then((_) {
      setState(() => _phase = 'roleSelect');
      _roleCtrl.forward();
    });
  }

  @override
  void dispose() {
    _emailController.dispose(); _phoneController.dispose();
    _companyRegController.dispose(); _passwordController.dispose();
    _splashCtrl.dispose(); _roleCtrl.dispose(); _formCtrl.dispose();
    super.dispose();
  }

  void _selectRole(bool isAdmin) {
    setState(() { _isAdminMode = isAdmin; _errorMessage = null; _phase = 'loginForm'; });
    _formCtrl.forward(from: 0.0);
  }

  void _backToRoleSelect() {
    _formCtrl.reverse().then((_) => setState(() { _phase = 'roleSelect'; _errorMessage = null; }));
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final result = _isAdminMode
          ? await ApiService.login(email: _emailController.text.trim(), password: _passwordController.text)
          : await ApiService.login(email: _phoneController.text.trim(), companyRegNum: _companyRegController.text.trim());
      if (result['success'] == true) {
        final role = result['user']['role'];
        if (_isAdminMode && role != 'admin' && role != 'superadmin') {
          setState(() { _errorMessage = "Access Denied: Only administrators can access this section."; _isLoading = false; });
          await ApiService.logout(); return;
        }
        if (!_isAdminMode && role != 'telecaller') {
          setState(() { _errorMessage = "Access Denied: Only telecallers can access this mobile app."; _isLoading = false; });
          await ApiService.logout(); return;
        }
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_role', role);
        if (result['user']?['id'] != null) await prefs.setInt('user_id', result['user']['id']);
        if (role == 'telecaller') {
          TelemetryService().startSession();
          if (mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const DashboardScreen()));
        } else {
          if (mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const CompanyAdminDashboardScreen()));
        }
      } else {
        setState(() { _errorMessage = result['error'] ?? 'Login failed.'; _isLoading = false; });
      }
    } catch (e) {
      setState(() { _errorMessage = 'An error occurred: $e'; _isLoading = false; });
    }
  }

  Future<void> _showForgotPasswordDialog() async {
    final emailCtrl = TextEditingController();
    final fKey = GlobalKey<FormState>();
    bool loading = false;
    showDialog(context: context, barrierDismissible: true, builder: (ctx) {
      return StatefulBuilder(builder: (ctx, setS) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reset Admin Password', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Form(key: fKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Enter your registered admin email. We will send a 6-digit OTP.', style: TextStyle(fontSize: 13)),
          const SizedBox(height: 14),
          TextFormField(
            controller: emailCtrl, keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Admin Email', prefixIcon: Icon(Icons.email_outlined), border: OutlineInputBorder()),
            validator: (v) => (v == null || v.trim().isEmpty || !v.contains('@')) ? 'Enter a valid email' : null),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            onPressed: loading ? null : () async {
              if (!fKey.currentState!.validate()) return;
              setS(() => loading = true);
              final res = await ApiService.forgotPassword(emailCtrl.text.trim());
              if (res['success'] == true) {
                if (ctx.mounted) { Navigator.pop(ctx); _showResetPasswordDialog(emailCtrl.text.trim()); }
              } else {
                setS(() => loading = false);
                if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(res['error'] ?? 'Failed'), backgroundColor: Colors.red));
              }
            },
            child: loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Send OTP', style: TextStyle(color: Colors.white))),
        ]));
    });
  }

  Future<void> _showResetPasswordDialog(String email) async {
    final otpCtrl = TextEditingController();
    final pwCtrl = TextEditingController();
    final cpwCtrl = TextEditingController();
    final fKey = GlobalKey<FormState>();
    bool loading = false;
    bool obscure = true;
    showDialog(context: context, barrierDismissible: false, builder: (ctx) {
      return StatefulBuilder(builder: (ctx, setS) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('OTP & New Password', style: TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(child: Form(key: fKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('OTP sent to $email', style: const TextStyle(fontSize: 13)), const SizedBox(height: 12),
          TextFormField(controller: otpCtrl, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(labelText: '6-Digit OTP', prefixIcon: Icon(Icons.security_outlined), counterText: '', border: OutlineInputBorder()), validator: (v) => (v == null || v.length != 6) ? 'Enter 6-digit OTP' : null),
          const SizedBox(height: 10),
          TextFormField(controller: pwCtrl, obscureText: obscure, decoration: InputDecoration(labelText: 'New Password', prefixIcon: const Icon(Icons.lock_outline), suffixIcon: IconButton(icon: Icon(obscure ? Icons.visibility_off : Icons.visibility), onPressed: () => setS(() => obscure = !obscure)), border: const OutlineInputBorder()), validator: (v) => (v == null || v.length < 6) ? 'Min 6 characters' : null),
          const SizedBox(height: 10),
          TextFormField(controller: cpwCtrl, obscureText: obscure, decoration: const InputDecoration(labelText: 'Confirm Password', prefixIcon: Icon(Icons.lock_outline), border: OutlineInputBorder()), validator: (v) => v != pwCtrl.text ? 'Passwords do not match' : null),
        ]))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            onPressed: loading ? null : () async {
              if (!fKey.currentState!.validate()) return;
              setS(() => loading = true);
              final res = await ApiService.resetPassword(email: email, otp: otpCtrl.text.trim(), newPassword: pwCtrl.text.trim());
              if (res['success'] == true) {
                if (ctx.mounted) { Navigator.pop(ctx); ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Password reset!'), backgroundColor: Colors.green)); }
              } else {
                setS(() => loading = false);
                if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(res['error'] ?? 'Failed'), backgroundColor: Colors.red));
              }
            },
            child: loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Reset Password', style: TextStyle(color: Colors.white))),
        ]));
    });
  }

  InputDecoration _field(String label, IconData icon, {String? hint}) => InputDecoration(
    labelText: label, hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
    prefixIcon: Icon(icon, color: const Color(0xFF6B7280), size: 20),
    filled: true, fillColor: const Color(0xFFF3F4F6),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5)),
  );

  Widget _roleCard({required String label, required String subtitle, required IconData icon, required Color bg, required Color fg, required VoidCallback onTap}) {
    return Expanded(child: GestureDetector(onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 1.5),
          boxShadow: [BoxShadow(color: fg.withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 4))]),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 64, height: 64, decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Icon(icon, color: fg, size: 30)),
          const SizedBox(height: 14),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF111827), height: 1.3)),
          const SizedBox(height: 4),
          Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
        ]))));
  }

  Widget _buildRoleSelect() {
    return Opacity(opacity: _roleOpacity.value, child: Column(children: [
      const SizedBox(height: 28),
      const Text('Welcome Back', textAlign: TextAlign.center,
        style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
      const SizedBox(height: 6),
      const Text('Select your account type to continue', textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
      const SizedBox(height: 32),
      Row(children: [
        _roleCard(label: 'Telecaller\nLogin', subtitle: 'Dialer workspace',
          icon: Icons.headset_mic_rounded, bg: const Color(0xFFEEF2FF), fg: const Color(0xFF6366F1),
          onTap: () => _selectRole(false)),
        const SizedBox(width: 16),
        _roleCard(label: 'Company\nAdmin Login', subtitle: 'Manage your team',
          icon: Icons.admin_panel_settings_rounded, bg: const Color(0xFFF0FDF4), fg: const Color(0xFF10B981),
          onTap: () => _selectRole(true)),
      ]),
    ]));
  }

  Widget _buildLoginForm() {
    final accentColor = _isAdminMode ? const Color(0xFF10B981) : const Color(0xFF6366F1);
    return Transform.translate(
      offset: Offset(0, _formSlide.value),
      child: Opacity(opacity: _formOpacity.value, child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          Row(children: [
            GestureDetector(
              onTap: _backToRoleSelect,
              child: Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE5E7EB))),
                child: const Icon(Icons.arrow_back_ios_new_rounded, size: 15, color: Color(0xFF6B7280)))),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: accentColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(_isAdminMode ? Icons.admin_panel_settings_rounded : Icons.headset_mic_rounded, size: 14, color: accentColor),
                const SizedBox(width: 6),
                Text(_isAdminMode ? 'Company Admin' : 'Telecaller',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: accentColor)),
              ])),
          ]),
          const SizedBox(height: 14),
          Container(
            decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(20),
              border: Border.all(color: accentColor.withOpacity(0.3), width: 2),
              boxShadow: [BoxShadow(color: accentColor.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4))]),
            padding: const EdgeInsets.all(20),
            child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_isAdminMode ? 'Admin Sign In' : 'Telecaller Sign In',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
              const SizedBox(height: 4),
              Text(_isAdminMode ? 'Email & password' : 'Company code & mobile',
                style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: const Color(0x26EF4444), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0x59EF4444))),
                  child: Row(children: [
                    const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 16),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w500))),
                  ])),
              ],
              const SizedBox(height: 18),
              if (!_isAdminMode) ...[
                TextFormField(
                  controller: _companyRegController, keyboardType: TextInputType.text,
                  textCapitalization: TextCapitalization.characters,
                  decoration: _field('Company Registration Code', Icons.business_sharp, hint: 'e.g. EAZ-123456'),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty || v.trim() == 'EAZ-') return 'Please enter Company Registration Code';
                    if (!v.trim().toUpperCase().startsWith('EAZ-')) return 'Must start with EAZ-';
                    return null;
                  }),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phoneController, keyboardType: TextInputType.phone,
                  decoration: _field('Registered Mobile Number', Icons.phone, hint: 'e.g. 9876543210'),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Please enter your mobile number';
                    if (v.trim().length < 8) return 'Enter a valid mobile number';
                    return null;
                  }),
              ] else ...[
                TextFormField(
                  controller: _emailController, keyboardType: TextInputType.emailAddress,
                  decoration: _field('Admin Email', Icons.email, hint: 'admin@company.com'),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Please enter email';
                    if (!v.contains('@')) return 'Enter a valid email';
                    return null;
                  }),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _passwordController, obscureText: _obscurePassword,
                  decoration: _field('Password', Icons.lock).copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off, color: const Color(0xFF6B7280), size: 20),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword))),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter password' : null),
                const SizedBox(height: 2),
                Align(alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _showForgotPasswordDialog,
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                    child: const Text('Forgot Password?', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF6366F1))))),
              ],
              const SizedBox(height: 20),
              SizedBox(width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: accentColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0),
                  child: _isLoading
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(_isAdminMode ? 'Access Admin Dashboard' : 'Access Dialer Workspace',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)))),
            ])),
          ),
        ])));
  }

  @override
  Widget build(BuildContext context) {
    final layout = ResponsiveLayout(context);
    return AnimatedBuilder(
      animation: Listenable.merge([_splashCtrl, _roleCtrl, _formCtrl]),
      builder: (context, _) {
        return Scaffold(
          backgroundColor: const Color(0xFFF3F4F6),
          resizeToAvoidBottomInset: true,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(horizontal: layout.scale(20.0, 28.0)),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: MediaQuery.of(context).size.height - MediaQuery.of(context).padding.top - MediaQuery.of(context).padding.bottom),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(height: _phase == 'loginForm' ? 24 : 52),
                      Center(child: SizedBox(
                        width: _phase == 'loginForm' ? 130 : 190,
                        height: _phase == 'loginForm' ? 130 : 190,
                        child: Image.asset('assets/logo.png', fit: BoxFit.contain))),
                      if (_phase == 'splash' && _spinnerOpacity.value > 0.0) ...[
                        const SizedBox(height: 20),
                        Opacity(opacity: _spinnerOpacity.value,
                          child: Center(child: SizedBox(width: 22, height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.0,
                              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)))))),
                      ],
                      if (_phase == 'roleSelect') _buildRoleSelect(),
                      if (_phase == 'loginForm') _buildLoginForm(),
                      const Spacer(),
                      if (_phase != 'splash')
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text('Made with ', style: TextStyle(color: Color(0xFF6B7280), fontSize: 11)),
                            Text('Eazzio Technologies Pvt Ltd', style: TextStyle(color: Color(0xFF6B7280), fontSize: 11, fontWeight: FontWeight.bold)),
                          ])),
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