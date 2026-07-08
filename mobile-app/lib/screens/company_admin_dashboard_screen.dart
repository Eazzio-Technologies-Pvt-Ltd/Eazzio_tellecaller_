import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/layout_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';

class CompanyAdminDashboardScreen extends StatefulWidget {
  const CompanyAdminDashboardScreen({super.key});

  @override
  State<CompanyAdminDashboardScreen> createState() => _CompanyAdminDashboardScreenState();
}

class _CompanyAdminDashboardScreenState extends State<CompanyAdminDashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  // Data States
  Map<String, dynamic> _analytics = {};
  List<dynamic> _telecallers = [];
  List<dynamic> _campaigns = [];
  List<dynamic> _callLogs = [];
  Map<String, dynamic> _billing = {};

  // Filter States
  int? _selectedTelecallerId;
  String _selectedDatePeriod = "today"; // today, month, all
  
  // Search state
  final TextEditingController _searchQueryController = TextEditingController();
  String _searchQuery = "";

  // Loading States
  bool _isLoadingAll = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(() {
      setState(() {}); // refresh FAB or header title based on active tab
    });
    _searchQueryController.addListener(() {
      setState(() {
        _searchQuery = _searchQueryController.text.trim().toLowerCase();
      });
    });
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchQueryController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoadingAll = true;
    });

    try {
      // Resolve date filter parameter
      String? dateParam;
      if (_selectedDatePeriod == "today") {
        dateParam = DateFormat('yyyy-MM-dd').format(DateTime.now());
      } else if (_selectedDatePeriod == "month") {
        dateParam = DateFormat('yyyy-MM').format(DateTime.now());
      }

      final analyticsData = await ApiService.fetchAnalytics(
        telecallerId: _selectedTelecallerId,
        date: dateParam,
      );
      final campaignsData = await ApiService.fetchCampaigns();
      final logsData = await ApiService.fetchCallLogs(
        telecallerId: _selectedTelecallerId,
        date: dateParam,
      );
      final billingData = await ApiService.fetchCompanyBilling();

      // Use the telecallers list from billing details to ensure it doesn't get shrunk during filtering
      final callersList = billingData['telecallers'] as List<dynamic>? ?? analyticsData['callers'] as List<dynamic>? ?? [];

      setState(() {
        _analytics = analyticsData;
        _telecallers = callersList;
        _campaigns = campaignsData;
        _callLogs = logsData;
        _billing = billingData;
        _isLoadingAll = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingAll = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load dashboard data: $e')),
      );
    }
  }

  Future<void> _handleLogout() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Sign Out', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to log out from Eazzio Admin Workspace?', 
            style: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF4B5563))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8))),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await ApiService.logout();
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                );
              }
            },
            child: const Text('Log Out', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // Formatting Helpers
  int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    if (value is String) {
      return int.tryParse(value) ?? 0;
    }
    return 0;
  }

  String _formatDuration(int seconds) {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return '${seconds}s';
    final int mins = seconds ~/ 60;
    final int remainingSecs = seconds % 60;
    if (mins < 60) {
      return '${mins}m ${remainingSecs}s';
    }
    final int hours = mins ~/ 60;
    final int remainingMins = mins % 60;
    return '${hours}h ${remainingMins}m';
  }

  String _formatDate(String dateStr) {
    try {
      final parsed = DateTime.parse(dateStr).toLocal();
      return DateFormat('hh:mm a | dd MMM').format(parsed);
    } catch (_) {
      return dateStr;
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'online':
        return const Color(0xFF10B981); // Emerald Green
      case 'break':
        return const Color(0xFFF59E0B); // Amber
      case 'calling':
        return const Color(0xFFEF4444); // Red
      case 'offline':
      default:
        return const Color(0xFF64748B); // Slate Gray
    }
  }

  // Show dialog to add a telecaller
  void _showAddTelecallerDialog() {
    final nameController = TextEditingController();
    final mobileController = TextEditingController();
    final passwordController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool obscure = true;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
          final textColor = isDark ? Colors.white : const Color(0xFF111827);
          final fieldFill = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);

          return AlertDialog(
            backgroundColor: cardColor,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text('Add Telecaller Account', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
            content: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: nameController,
                      decoration: InputDecoration(
                        labelText: 'Name',
                        filled: true,
                        fillColor: fieldFill,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Please enter name' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: mobileController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Registered Mobile Number (Login ID)',
                        filled: true,
                        fillColor: fieldFill,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        hintText: 'e.g. 9876543210',
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Please enter mobile number';
                        if (v.trim().length < 8) return 'Enter a valid mobile number';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: passwordController,
                      obscureText: obscure,
                      decoration: InputDecoration(
                        labelText: 'Default Password',
                        filled: true,
                        fillColor: fieldFill,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        suffixIcon: IconButton(
                          icon: Icon(obscure ? Icons.visibility : Icons.visibility_off),
                          onPressed: () => setDialogState(() => obscure = !obscure),
                        ),
                      ),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Please enter password' : null,
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  Navigator.pop(context);
                  
                  setState(() {
                    _isLoadingAll = true;
                  });

                  final res = await ApiService.registerTelecaller(
                    nameController.text.trim(),
                    mobileController.text.trim(),
                    passwordController.text,
                  );

                  if (res['success'] == true) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Telecaller account added successfully.')),
                    );
                    _fetchData();
                  } else {
                    setState(() {
                      _isLoadingAll = false;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(res['error'] ?? 'Failed to add telecaller.')),
                    );
                  }
                },
                child: const Text('Add Account'),
              ),
            ],
          );
        },
      ),
    );
  }

  // Show dialog to edit a telecaller
  void _showEditTelecallerDialog(Map<String, dynamic> tc) {
    final nameController = TextEditingController(text: tc['name']);
    final mobileController = TextEditingController(text: tc['email']);
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
        final textColor = isDark ? Colors.white : const Color(0xFF111827);
        final fieldFill = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);

        return AlertDialog(
          backgroundColor: cardColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('Edit Telecaller Profile', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameController,
                  decoration: InputDecoration(
                    labelText: 'Name',
                    filled: true,
                    fillColor: fieldFill,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Please enter name' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: mobileController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Registered Mobile Number',
                    filled: true,
                    fillColor: fieldFill,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Please enter mobile number' : null,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(context);

                setState(() {
                  _isLoadingAll = true;
                });

                final res = await ApiService.editTelecaller(
                  tc['id'],
                  nameController.text.trim(),
                  mobileController.text.trim(),
                );

                if (res['success'] == true) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Telecaller profile updated.')),
                  );
                  _fetchData();
                } else {
                  setState(() {
                    _isLoadingAll = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['error'] ?? 'Failed to update telecaller.')),
                  );
                }
              },
              child: const Text('Save Changes'),
            ),
          ],
        );
      },
    );
  }

  // Delete telecaller
  void _confirmDeleteTelecaller(Map<String, dynamic> tc) {
    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;

        return AlertDialog(
          backgroundColor: cardColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Delete Telecaller', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Text('Are you sure you want to delete ${tc['name']}?\nThis will permanently delete all call logs and telemetry statistics associated with this telecaller.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () async {
                Navigator.pop(context);
                setState(() {
                  _isLoadingAll = true;
                });
                final success = await ApiService.deleteTelecaller(tc['id']);
                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Telecaller deleted successfully.')),
                  );
                  _fetchData();
                } else {
                  setState(() {
                    _isLoadingAll = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to delete telecaller.')),
                  );
                }
              },
              child: const Text('Delete', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  // Add campaign dialog
  void _showAddCampaignDialog() {
    final nameController = TextEditingController();
    final descController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
        final textColor = isDark ? Colors.white : const Color(0xFF111827);
        final fieldFill = isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6);

        return AlertDialog(
          backgroundColor: cardColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('Create Dialer Campaign', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameController,
                  decoration: InputDecoration(
                    labelText: 'Campaign Name',
                    filled: true,
                    fillColor: fieldFill,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Please enter campaign name' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: descController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Description (Optional)',
                    filled: true,
                    fillColor: fieldFill,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(context);

                setState(() {
                  _isLoadingAll = true;
                });

                final res = await ApiService.createCampaign(
                  nameController.text.trim(),
                  descController.text.trim(),
                );

                if (res['success'] == true) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Dialer campaign created successfully.')),
                  );
                  _fetchData();
                } else {
                  setState(() {
                    _isLoadingAll = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['error'] ?? 'Failed to create campaign.')),
                  );
                }
              },
              child: const Text('Create'),
            ),
          ],
        );
      },
    );
  }

  // Delete Campaign
  void _confirmDeleteCampaign(Map<String, dynamic> camp) {
    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;

        return AlertDialog(
          backgroundColor: cardColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Delete Campaign', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Text('Are you sure you want to delete "${camp['name']}"?\nThis will delete the campaign, all uploaded contacts under this campaign, and their call logs.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () async {
                Navigator.pop(context);
                setState(() {
                  _isLoadingAll = true;
                });
                final success = await ApiService.deleteCampaign(camp['id']);
                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Campaign deleted.')),
                  );
                  _fetchData();
                } else {
                  setState(() {
                    _isLoadingAll = false;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to delete campaign.')),
                  );
                }
              },
              child: const Text('Delete', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  // Change Campaign Status
  void _changeCampaignStatus(Map<String, dynamic> camp, String currentStatus) {
    final List<String> statuses = ['pending', 'active', 'paused', 'completed'];
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final sheetColor = isDark ? const Color(0xFF12131A) : Colors.white;
        final textColor = isDark ? Colors.white : const Color(0xFF111827);

        return Container(
          color: sheetColor,
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Change Campaign Status',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
              ),
              const SizedBox(height: 10),
              ...statuses.map((status) {
                final isSelected = status == currentStatus;
                return ListTile(
                  title: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      color: isSelected ? Theme.of(context).primaryColor : textColor,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  trailing: isSelected ? Icon(Icons.check_circle, color: Theme.of(context).primaryColor) : null,
                  onTap: () async {
                    Navigator.pop(context);
                    if (isSelected) return;

                    setState(() {
                      _isLoadingAll = true;
                    });

                    final success = await ApiService.updateCampaignStatus(camp['id'], status);
                    if (success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Campaign status updated to ${status.toUpperCase()}.')),
                      );
                      _fetchData();
                    } else {
                      setState(() {
                        _isLoadingAll = false;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Failed to update campaign status.')),
                      );
                    }
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  // Visual widgets
  Widget _buildBillingItem({
    required String label,
    required String value,
    required bool isDark,
    Color? valueColor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 9.0,
            color: Colors.white70,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: valueColor ?? Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _buildKPICard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required ResponsiveLayout layout,
    required bool isDark,
  }) {
    final cardBg = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF);

    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? borderColor : const Color(0xFFEEF2FF), width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(
                width: 5,
                color: color,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 17, top: 12, bottom: 12, right: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.08),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, color: color, size: 18),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 9,
                          color: Color(0xFF94A3B8),
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        value,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConnectionRateCard(double rate, bool isDark) {
    final cardBg = isDark ? const Color(0xFF12131A) : Colors.white;
    const color = Color(0xFF0D9488);
    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF), width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(
                width: 5,
                color: color,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 21, right: 16, top: 12, bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CONNECTION RATE',
                        style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${rate.toStringAsFixed(1)}%',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color),
                      ),
                    ],
                  ),
                  // Grey horizontal bar
                  Container(
                    width: 80,
                    height: 6,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: Stack(
                      children: [
                        FractionallySizedBox(
                          widthFactor: (rate / 100).clamp(0.0, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              color: color,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvgDurationCard(double seconds, bool isDark) {
    final cardBg = isDark ? const Color(0xFF12131A) : Colors.white;
    const color = Color(0xFF3B82F6);
    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF), width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(
                width: 5,
                color: color,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 21, right: 16, top: 12, bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'AVG CALL DURATION',
                        style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${seconds.toStringAsFixed(1)}s',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color),
                      ),
                    ],
                  ),
                  const Icon(Icons.arrow_forward, color: color, size: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Tab 1: Analytics View ──
  Widget _buildAnalyticsTab(ResponsiveLayout layout, bool isDark) {
    final overview = _analytics['overview'] ?? {};
    
    final int totalContactsInt = _parseInt(overview['total_contacts']);
    final int connectedInt = _parseInt(overview['connected_calls']);
    final int missedInt = _parseInt(overview['missed_calls']);
    final int nonConnectedInt = _parseInt(overview['non_connected_calls']);
    final int talkTimeInt = _parseInt(overview['total_talk_time']);

    final int totalCalls = connectedInt + missedInt + nonConnectedInt;
    final double connectionRate = totalCalls > 0 ? (connectedInt / totalCalls) * 100 : 0.0;
    final double avgDuration = connectedInt > 0 ? (talkTimeInt / connectedInt) : 0.0;

    final String totalContacts = totalContactsInt.toString();
    final String connected = connectedInt.toString();
    final String missed = missedInt.toString();
    final String talkTime = _formatDuration(talkTimeInt);

    return RefreshIndicator(
      onRefresh: _fetchData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(layout.padding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Filter Controls Row (Today & sumit dropdown cards)
            Row(
              children: [
                // Period Card Filter
                Expanded(
                  child: PopupMenuButton<String>(
                    onSelected: (val) {
                      setState(() {
                        _selectedDatePeriod = val;
                      });
                      _fetchData();
                    },
                    itemBuilder: (context) => const [
                      PopupMenuItem(value: "today", child: Text("Today")),
                      PopupMenuItem(value: "month", child: Text("This Month")),
                      PopupMenuItem(value: "all", child: Text("All Time")),
                    ],
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF12131A) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF), width: 1.5),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "VIEWING",
                                style: TextStyle(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _selectedDatePeriod == "today"
                                    ? "Today"
                                    : _selectedDatePeriod == "month"
                                        ? "This Month"
                                        : "All Time",
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF4F46E5),
                                ),
                              ),
                            ],
                          ),
                          const Icon(Icons.calendar_today_outlined, color: Color(0xFF4F46E5), size: 16),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // User Card Filter
                Expanded(
                  child: PopupMenuButton<int?>(
                    onSelected: (val) {
                      setState(() {
                        _selectedTelecallerId = val;
                      });
                      _fetchData();
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem<int?>(value: null, child: Text("All Callers")),
                      ..._telecallers.map((tc) {
                        return PopupMenuItem<int?>(
                          value: _parseInt(tc['id']),
                          child: Text(tc['name'] ?? 'Telecaller'),
                        );
                      }).toList(),
                    ],
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF12131A) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF), width: 1.5),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "USER",
                                style: TextStyle(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _selectedTelecallerId == null
                                    ? "All Callers"
                                    : (_telecallers.firstWhere(
                                        (tc) => _parseInt(tc['id']) == _selectedTelecallerId,
                                        orElse: () => {'name': 'User'},
                                      )['name'] ?? 'User'),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF4F46E5),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const Icon(Icons.person_outline, color: Color(0xFF4F46E5), size: 16),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            
            // Premium Subscription Card
            if (_billing.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF007A78), Color(0xFF0D9488)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _billing['name'] ?? 'Workspace',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Row(
                              children: [
                                Icon(Icons.check_circle_outline, color: Colors.white70, size: 11),
                                SizedBox(width: 4),
                                Text(
                                  'Active Enterprise Hub',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    color: Colors.white70,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            (_billing['planType'] ?? 'monthly').toString().toUpperCase(),
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Divider(color: Colors.white24, height: 1),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildBillingItem(
                          label: 'LICENSES', 
                          value: '${_billing['noOfTelecallers'] ?? 0}', 
                          isDark: isDark,
                        ),
                        _buildBillingItem(
                          label: 'CALL RECORDING', 
                          value: (_billing['callRecordingEnabled'] == true) ? 'Enabled' : 'Disabled', 
                          isDark: isDark,
                        ),
                      ],
                    ),
                    if (_billing['subscriptionEnd'] != null) ...[
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Subscription Renews:',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.white70,
                            ),
                          ),
                          Text(
                            _formatDate(_billing['subscriptionEnd']),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),

            // KPI Grid (Vertical Cards matching Mockup)
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.5,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              children: [
                _buildKPICard(
                  title: 'Total Contacts',
                  value: totalContacts,
                  icon: Icons.people_alt_outlined,
                  color: const Color(0xFF6366F1), // Indigo
                  layout: layout,
                  isDark: isDark,
                ),
                _buildKPICard(
                  title: 'Connected Calls',
                  value: connected,
                  icon: Icons.call_made_outlined,
                  color: const Color(0xFF10B981), // Emerald
                  layout: layout,
                  isDark: isDark,
                ),
                _buildKPICard(
                  title: 'Missed Calls',
                  value: missed,
                  icon: Icons.call_missed_outgoing_outlined,
                  color: const Color(0xFFEF4444), // Rose
                  layout: layout,
                  isDark: isDark,
                ),
                _buildKPICard(
                  title: 'Total Talk Time',
                  value: talkTime,
                  icon: Icons.access_time_outlined,
                  color: const Color(0xFFF59E0B), // Amber
                  layout: layout,
                  isDark: isDark,
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Secondary KPI Cards (Detailed Stats)
            _buildConnectionRateCard(connectionRate, isDark),
            const SizedBox(height: 10),
            _buildAvgDurationCard(avgDuration, isDark),
            const SizedBox(height: 20),

            // Section: Telecaller Leaderboard / Activities
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Today's Telecaller Activities",
                  style: TextStyle(
                    fontSize: layout.scale(13.5, 15.0),
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    _tabController.animateTo(1);
                  },
                  child: const Text(
                    "VIEW ALL",
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (_telecallers.isEmpty)
              Card(
                color: isDark ? const Color(0xFF12131A) : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Center(
                    child: Text(
                      'No telecaller activity logged today.',
                      style: TextStyle(color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8), fontSize: 12),
                    ),
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _telecallers.length > 3 ? 3 : _telecallers.length, // show top 3 on dashboard
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final tc = _telecallers[index];
                  final status = tc['status'] ?? 'offline';
                  final String currentSessionTime = _formatDuration(_parseInt(tc['calling_time']));
                  final int callsCount = _parseInt(tc['connected_count']) + _parseInt(tc['non_connected_count']) + _parseInt(tc['missed_count']);

                  return Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF12131A) : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF)),
                    ),
                    child: Row(
                      children: [
                        // Status indicator circle
                        Stack(
                          alignment: Alignment.bottomRight,
                          children: [
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                              child: Text(
                                tc['name'] != null && tc['name'].isNotEmpty ? tc['name'][0].toUpperCase() : 'T',
                                style: TextStyle(color: Theme.of(context).primaryColor, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                color: _getStatusColor(status),
                                shape: BoxShape.circle,
                                border: Border.all(color: isDark ? const Color(0xFF12131A) : Colors.white, width: 1.5),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 10),
                        
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tc['name'] ?? 'Telecaller',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12.5,
                                  color: isDark ? Colors.white : const Color(0xFF111827),
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                status.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: _getStatusColor(status),
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Stats Summary Right
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '$callsCount Calls Today',
                              style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? Colors.white : const Color(0xFF111827),
                                ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              'Duration: $currentSessionTime',
                              style: TextStyle(
                                fontSize: 9.5,
                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
              
            // Shortcut Quick Actions
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 70,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF12131A) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF), width: 1.5),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.headset_mic_outlined, color: Theme.of(context).primaryColor, size: 20),
                        const SizedBox(height: 4),
                        const Text(
                          "Live Dialer",
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    height: 70,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF12131A) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF), width: 1.5),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.assignment_ind_outlined, color: Colors.teal, size: 20),
                        const SizedBox(height: 4),
                        const Text(
                          "Lead Flow",
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Tab 2: Telecallers View ──
  Widget _buildTelecallersTab(ResponsiveLayout layout, bool isDark) {
    // Filter telecallers list based on search query
    final filtered = _telecallers.where((tc) {
      final name = (tc['name'] ?? "").toString().toLowerCase();
      final email = (tc['email'] ?? "").toString().toLowerCase();
      return name.contains(_searchQuery) || email.contains(_searchQuery);
    }).toList();

    return Column(
      children: [
        // Search bar
        Padding(
          padding: EdgeInsets.all(layout.padding),
          child: TextField(
            controller: _searchQueryController,
            decoration: InputDecoration(
              hintText: 'Search telecallers...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchQuery.isNotEmpty 
                  ? IconButton(
                      icon: const Icon(Icons.clear), 
                      onPressed: () => _searchQueryController.clear(),
                    ) 
                  : null,
              filled: true,
              fillColor: isDark ? const Color(0xFF12131A) : Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
              ),
            ),
          ),
        ),

        Expanded(
          child: RefreshIndicator(
            onRefresh: _fetchData,
            child: filtered.isEmpty
                ? ListView(
                    children: [
                      SizedBox(height: layout.scale(80, 120)),
                      Center(
                        child: Text(
                          _searchQuery.isNotEmpty ? 'No telecallers match your search.' : 'No telecallers registered.',
                          style: TextStyle(color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: EdgeInsets.symmetric(horizontal: layout.padding),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final tc = filtered[index];
                      final status = tc['status'] ?? 'offline';

                      return Container(
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF12131A) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                        ),
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: _getStatusColor(status).withOpacity(0.1),
                            child: Icon(Icons.person, color: _getStatusColor(status)),
                          ),
                          title: Text(
                            tc['name'] ?? 'Telecaller',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : const Color(0xFF111827),
                            ),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 2),
                              Text(tc['email'] ?? 'No mobile number', style: const TextStyle(fontSize: 12)),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _getStatusColor(status).withOpacity(0.08),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  status.toUpperCase(),
                                  style: TextStyle(color: _getStatusColor(status), fontSize: 9, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, color: Colors.blue),
                                onPressed: () => _showEditTelecallerDialog(tc),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline_outlined, color: Colors.red),
                                onPressed: () => _confirmDeleteTelecaller(tc),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  // ── Tab 3: Campaigns View ──
  Widget _buildCampaignsTab(ResponsiveLayout layout, bool isDark) {
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: _campaigns.isEmpty
          ? ListView(
              children: [
                SizedBox(height: layout.scale(100, 150)),
                Center(
                  child: Text(
                    'No campaigns found. Create one using the + button below!',
                    style: TextStyle(color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: EdgeInsets.all(layout.padding),
              itemCount: _campaigns.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final camp = _campaigns[index];
                final String status = camp['status'] ?? 'pending';
                
                final int total = int.tryParse(camp['total_contacts']?.toString() ?? '0') ?? 0;
                final int completed = int.tryParse(camp['completed_contacts']?.toString() ?? '0') ?? 0;
                final double progress = total > 0 ? (completed / total) : 0.0;
                final String percentStr = "${(progress * 100).toInt()}%";

                Color statusColor;
                switch (status.toLowerCase()) {
                  case 'active':
                    statusColor = const Color(0xFF10B981);
                    break;
                  case 'completed':
                    statusColor = const Color(0xFF6366F1);
                    break;
                  case 'paused':
                    statusColor = const Color(0xFFF59E0B);
                    break;
                  case 'pending':
                  default:
                    statusColor = const Color(0xFF64748B);
                }

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF12131A) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              camp['name'] ?? 'Campaign',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : const Color(0xFF111827),
                              ),
                            ),
                          ),
                          
                          // Dropdown / Status selector
                          InkWell(
                            onTap: () => _changeCampaignStatus(camp, status),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: statusColor.withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    status.toUpperCase(),
                                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(Icons.arrow_drop_down, color: statusColor, size: 14),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      if (camp['description'] != null && camp['description'].toString().isNotEmpty) ...[
                        Text(
                          camp['description'],
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],

                      // Stats
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Allotment: $completed/$total Contacts',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                          ),
                          Text(
                            percentStr,
                            style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Progress bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 5,
                          backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6),
                          valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                        ),
                      ),
                      
                      const SizedBox(height: 8),
                      // Action buttons
                      Align(
                        alignment: Alignment.centerRight,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                          onPressed: () => _confirmDeleteCampaign(camp),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }

  // ── Tab 4: Call Logs View ──
  Widget _buildCallLogsTab(ResponsiveLayout layout, bool isDark) {
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: _callLogs.isEmpty
          ? ListView(
              children: [
                SizedBox(height: layout.scale(100, 150)),
                Center(
                  child: Text(
                    'No call logs submitted yet.',
                    style: TextStyle(color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: EdgeInsets.all(layout.padding),
              itemCount: _callLogs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final log = _callLogs[index];
                final status = log['call_status'] ?? 'connected';
                final int duration = int.tryParse(log['duration']?.toString() ?? '0') ?? 0;

                IconData statusIcon;
                Color statusColor;
                switch (status.toLowerCase()) {
                  case 'connected':
                  case 'received':
                  case 'completed':
                    statusIcon = Icons.call_received;
                    statusColor = const Color(0xFF10B981);
                    break;
                  case 'missed':
                    statusIcon = Icons.call_missed;
                    statusColor = const Color(0xFFEF4444);
                    break;
                  case 'non-connected':
                  default:
                    statusIcon = Icons.call_missed_outgoing;
                    statusColor = const Color(0xFFF59E0B);
                }

                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF12131A) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Status Circle Icon
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(statusIcon, color: statusColor, size: 18),
                      ),
                      const SizedBox(width: 12),

                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    log['contact_name'] ?? 'Unknown Contact',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: isDark ? Colors.white : const Color(0xFF111827),
                                    ),
                                  ),
                                ),
                                Text(
                                  _formatDate(log['called_at'] ?? ''),
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Phone: ${log['contact_phone'] ?? 'No number'}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            const SizedBox(height: 2),
                            RichText(
                              text: TextSpan(
                                children: [
                                  TextSpan(
                                    text: 'Dialed By: ',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                  TextSpan(
                                    text: log['telecaller_name'] ?? 'Deleted Telecaller',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: isDark ? Colors.white : const Color(0xFF111827),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (log['feedback'] != null && log['feedback'].toString().trim().isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  log['feedback'],
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontStyle: FontStyle.italic,
                                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF4B5563),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      
                      // Duration badge right
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _formatDuration(duration),
                          style: const TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Header Colors
    final headerBg = isDark ? const Color(0xFF0A0B10) : const Color(0xFFF3F4F6);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);

    const String tabTitle = "Dashboard";

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0B10) : const Color(0xFFF9FAFB),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(color: Theme.of(context).primaryColor),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(_billing['name'] ?? 'Admin Workspace', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.dashboard_outlined),
              title: const Text('Dashboard'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(context);
                _handleLogout();
              },
            ),
          ],
        ),
      ),
      appBar: AppBar(
        backgroundColor: headerBg,
        title: Text(
          tabTitle,
          style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          // Refresh Button
          IconButton(
            icon: const Icon(Icons.sync, size: 20),
            onPressed: _fetchData,
            tooltip: 'Refresh Data',
          ),
          // Logout Button
          IconButton(
            icon: const Icon(Icons.logout_outlined, color: Colors.red, size: 20),
            onPressed: _handleLogout,
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: _isLoadingAll 
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildAnalyticsTab(layout, isDark),
                _buildTelecallersTab(layout, isDark),
                _buildCampaignsTab(layout, isDark),
                _buildCallLogsTab(layout, isDark),
              ],
            ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tabController.index,
        onTap: (index) {
          _tabController.animateTo(index);
          setState(() {});
        },
        type: BottomNavigationBarType.fixed,
        backgroundColor: headerBg,
        selectedItemColor: Theme.of(context).primaryColor,
        unselectedItemColor: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
        selectedFontSize: 11,
        unselectedFontSize: 10,
        iconSize: 20,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.analytics_outlined), label: 'Analytics'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline), label: 'Callers'),
          BottomNavigationBarItem(icon: Icon(Icons.campaign_outlined), label: 'Campaigns'),
          BottomNavigationBarItem(icon: Icon(Icons.description_outlined), label: 'Logs'),
        ],
      ),
      floatingActionButton: _tabController.index == 1 
          ? FloatingActionButton(
              onPressed: _showAddTelecallerDialog,
              backgroundColor: Theme.of(context).primaryColor,
              child: const Icon(Icons.person_add, color: Colors.white),
            )
          : _tabController.index == 2
              ? FloatingActionButton(
                  onPressed: _showAddCampaignDialog,
                  backgroundColor: Theme.of(context).primaryColor,
                  child: const Icon(Icons.add_road, color: Colors.white),
                )
              : null,
    );
  }
}
