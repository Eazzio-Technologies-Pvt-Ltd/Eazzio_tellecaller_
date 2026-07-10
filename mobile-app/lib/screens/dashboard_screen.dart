import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';
import 'package:eazzio_telecaller/services/call_service.dart';
import 'package:eazzio_telecaller/screens/calling_screen.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/main.dart';
import 'package:eazzio_telecaller/services/layout_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final TelemetryService _telemetry = TelemetryService();
  final CallService _callService = CallService();
  int _leadHoldingPeriod = 7;
  Timer? _uiRefreshTimer;
  Timer? _syncTimer;
  bool _isSyncing = false;
  List<Map<String, dynamic>> _availableSims = [];
  bool _loadingSims = false;

  int _currentTabIndex = 0;
  Map<String, dynamic>? _profileUser;
  bool _loadingProfile = false;
  List<dynamic> _colleagues = [];
  List<dynamic> _allottedContacts = [];
  List<dynamic> _transferRequests = [];
  bool _loadingContacts = false;
  bool _loadingTransfers = false;
  String _profileImagePath = '';
  String _searchQuery = '';
  final TextEditingController _profileNameController = TextEditingController();
  final TextEditingController _transferReasonController = TextEditingController();
  int? _selectedColleagueId;

  Future<void> _fetchAndSelectSim() async {
    final status = await Permission.phone.request();
    if (!status.isGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Phone State permission is required to select SIM slots.')),
      );
      return;
    }

    setState(() {
      _loadingSims = true;
    });

    try {
      const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
      final List<dynamic>? sims = await channel.invokeMethod('getAvailableSims');
      
      if (sims != null) {
        setState(() {
          _availableSims = sims.map((e) => Map<String, dynamic>.from(e)).toList();
        });
      }
      
      _showSimPickerDialog();
    } catch (e) {
      print('Error fetching sims: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading SIM info: $e')),
      );
    } finally {
      setState(() {
        _loadingSims = false;
      });
    }
  }

  void _showSimPickerDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Select Calling SIM Slot', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18)),
        content: _availableSims.isEmpty
            ? Text('No active SIM cards detected. The app will use the system default dialer.', style: TextStyle(color: subtextColor, fontSize: 14))
            : Container(
                width: double.maxFinite,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _availableSims.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return ListTile(
                        title: Text('Default Dialer (System Prompts)', style: TextStyle(color: textColor, fontWeight: FontWeight.w600)),
                        subtitle: Text('Let Android manage SIM selection', style: TextStyle(color: subtextColor, fontSize: 12)),
                        leading: Radio<int?>(
                          value: null,
                          groupValue: _callService.selectedSlotIndex,
                          activeColor: const Color(0xFF6366F1),
                          onChanged: (val) {
                            _selectSim(null, null, 'Default Dialer');
                            Navigator.pop(context);
                          },
                        ),
                        onTap: () {
                          _selectSim(null, null, 'Default Dialer');
                          Navigator.pop(context);
                        },
                      );
                    }
                    
                    final sim = _availableSims[index - 1];
                    final int slot = sim['slotIndex'] ?? 0;
                    final int subId = sim['subscriptionId'] ?? -1;
                    final String carrier = sim['carrierName'] ?? 'Unknown';
                    final String name = sim['displayName'] ?? 'SIM ${slot + 1}';
                    
                    return ListTile(
                      title: Text('$name ($carrier)', style: TextStyle(color: textColor, fontWeight: FontWeight.w600)),
                      subtitle: Text('SIM Card Slot ${slot + 1}', style: TextStyle(color: subtextColor, fontSize: 12)),
                      leading: Radio<int?>(
                        value: slot,
                        groupValue: _callService.selectedSlotIndex,
                        activeColor: const Color(0xFF6366F1),
                        onChanged: (val) {
                          _selectSim(slot, subId, '$name ($carrier)');
                          Navigator.pop(context);
                        },
                      ),
                      onTap: () {
                        _selectSim(slot, subId, '$name ($carrier)');
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Close', style: TextStyle(color: subtextColor)),
          ),
        ],
      ),
    );
  }

  void _selectSim(int? slotIndex, int? subscriptionId, String label) async {
    await _callService.saveSimSelection(slotIndex, subscriptionId, label);
    setState(() {});
  }

  Widget _buildSimSelectionCard() {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    final String label = _callService.selectedSimLabel ?? 'Default Dialer (System Prompts)';
    Widget simLabelWidget;
    if (label.contains(' (')) {
      final parts = label.split(' (');
      simLabelWidget = RichText(
        text: TextSpan(
          children: [
            TextSpan(
              text: parts[0],
              style: TextStyle(
                fontSize: layout.scale(13.0, 15.0),
                fontWeight: FontWeight.bold,
                color: textColor,
              ),
            ),
            TextSpan(
              text: ' (${parts[1]}',
              style: TextStyle(
                fontSize: layout.scale(11.0, 13.0),
                fontWeight: FontWeight.normal,
                color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      );
    } else {
      simLabelWidget = Text(
        label,
        style: TextStyle(
          fontSize: layout.scale(13.0, 15.0),
          fontWeight: FontWeight.bold,
          color: textColor,
        ),
      );
    }

    return Container(
      padding: EdgeInsets.all(layout.scale(12.0, 16.0)),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(layout.cardRadius),
        border: Border.all(
          color: const Color(0xFF3B82F6).withOpacity(0.50),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Device/SIM badge
          Container(
            width: layout.scale(38.0, 46.0),
            height: layout.scale(38.0, 46.0),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFEEF2FF),
              borderRadius: BorderRadius.circular(layout.scale(10.0, 12.0)),
            ),
            child: Icon(
              Icons.phone_iphone_rounded,
              color: const Color(0xFF4F46E5),
              size: layout.scale(18.0, 22.0),
            ),
          ),
          SizedBox(width: layout.scale(8.0, 12.0)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Calling SIM Option',
                  style: TextStyle(
                    fontSize: layout.scale(10.0, 11.0),
                    fontWeight: FontWeight.bold,
                    color: subtextColor,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                simLabelWidget,
              ],
            ),
          ),
          SizedBox(width: layout.scale(4.0, 8.0)),
          _loadingSims
              ? SizedBox(
                  width: layout.scale(16.0, 20.0),
                  height: layout.scale(16.0, 20.0),
                  child: const CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)),
                )
              : GestureDetector(
                  onTap: _fetchAndSelectSim,
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: layout.scale(10.0, 12.0),
                      vertical: layout.scale(6.0, 8.0),
                    ),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E1B4B) : const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isDark ? const Color(0xFF312E81) : const Color(0xFFC7D2FE),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Select SIM',
                          style: TextStyle(
                            color: isDark ? const Color(0xFF818CF8) : const Color(0xFF4F46E5),
                            fontWeight: FontWeight.bold,
                            fontSize: layout.scale(11.0, 12.0),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color: isDark ? const Color(0xFF818CF8) : const Color(0xFF4F46E5),
                          size: layout.scale(14.0, 16.0),
                        ),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Future<void> _syncCallLogs() async {
    if (_isSyncing || !ApiService.isAuthenticated) return;
    
    // Check if the session is active (working time) and not on break
    if (!_telemetry.isActive || _telemetry.currentState == TelemetryState.onBreak) return;

    _isSyncing = true;
    try {
      final contacts = await ApiService.fetchAllottedContacts();
      if (contacts.isEmpty) {
        _isSyncing = false;
        return;
      }

      const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
      
      // Check Call Log permission first
      bool hasCallLogPerm = false;
      try {
        hasCallLogPerm = await channel.invokeMethod('checkCallLogPermission') ?? false;
      } catch (e) {
        print('Error checking native call log permission: $e');
      }
      if (!hasCallLogPerm) {
        _isSyncing = false;
        return;
      }

      // Fetch a larger limit of recent call logs to cover the day
      final List<dynamic>? logs = await channel.invokeMethod('getRecentCallLogs', {'limit': 200});
      if (logs == null || logs.isEmpty) {
        _isSyncing = false;
        return;
      }

      final now = DateTime.now();
      final startOfToday = DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;

      int connected = 0;
      int nonConnected = 0;
      int received = 0;
      int missed = 0;

      for (final log in logs) {
        if (log is! Map) continue;
        final String rawNumber = log['number'] ?? '';
        final String logNum = rawNumber.replaceAll(RegExp(r'\D'), '');
        if (logNum.isEmpty) continue;

        // Find if this number matches any allotted contact
        final contact = contacts.firstWhere((c) {
          final String cNum = c['phone_number'].toString().replaceAll(RegExp(r'\D'), '');
          return cNum.endsWith(logNum) || logNum.endsWith(cNum);
        }, orElse: () => null);

        if (contact != null) {
          final int type = log['type'] ?? 0;
          final int duration = log['duration'] ?? 0;
          final int dateMs = log['date'] ?? 0;
          final DateTime calledAt = DateTime.fromMillisecondsSinceEpoch(dateMs);

          String callStatus = 'missed';
          if (type == 2) {
            // Outgoing
            callStatus = duration > 0 ? 'connected' : 'non-connected';
          } else if (type == 1) {
            // Incoming
            callStatus = duration > 0 ? 'received' : 'missed';
          } else if (type == 3 || type == 5) {
            // Missed or Rejected
            callStatus = 'missed';
          } else {
            continue;
          }

          // Count stats for today matching our allotted contacts
          if (dateMs >= startOfToday) {
            if (callStatus == 'connected') {
              connected++;
            } else if (callStatus == 'non-connected') {
              nonConnected++;
            } else if (callStatus == 'received') {
              received++;
            } else if (callStatus == 'missed') {
              missed++;
            }
          }

          // Sync to server via submitCallLog API. 
          // The backend will check if it already exists, avoiding duplicates.
          await ApiService.submitCallLog(
            contactId: contact['id'],
            callStatus: callStatus,
            duration: duration,
            feedback: 'Automatically synchronized from device call logs.',
            followUpDate: null,
            recordingPath: null,
            calledAt: calledAt.toUtc().toIso8601String(),
          );
        }
      }

      // Update telemetry counters for today with the real call log data
      setState(() {
        _telemetry.connectedCalls = connected;
        _telemetry.nonConnectedCalls = nonConnected;
        _telemetry.receivedCalls = received;
        _telemetry.missedCalls = missed;
      });

    } catch (e) {
      print('[Sync] Error syncing call logs: $e');
    } finally {
      _isSyncing = false;
    }
  }

  @override
  void initState() {
    super.initState();
    // Refresh stats UI every second to update active timer states
    _uiRefreshTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {});
        _checkShiftCompletion();
      }
    });
    // Start telemetry session automatically on entry if not already active
    if (!_telemetry.isActive) {
      _telemetry.startSession();
    } else {
      _telemetry.initializeSessionFromServer();
    }

    // Run first call log sync and start periodic timer
    _syncCallLogs();
    _syncTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      if (mounted) {
        _syncCallLogs();
      }
    });
    // Load profile and lead manager data
    _loadProfileData();
    _loadLeadManagerData();
    _loadHoldingPeriod();
  }

  void _checkShiftCompletion() {
    if (_telemetry.workingTime >= 28800 && !_telemetry.shiftCompleteShown) {
      _telemetry.shiftCompleteShown = true;
      _showShiftCompleteDialog();
    }
  }

  Future<void> _loadHoldingPeriod() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _leadHoldingPeriod = prefs.getInt('lead_holding_period') ?? 7;
    });
  }

  void _showLeadHoldingPeriodDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final controller = TextEditingController(text: _leadHoldingPeriod.toString());

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Lead Holding Period', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Set the number of days a lead can be held before automatic reallocation.', style: TextStyle(color: subtextColor, fontSize: 13, height: 1.4)),
            const SizedBox(height: 16),
            TextFormField(
              controller: controller,
              style: TextStyle(color: textColor),
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Period (Days)',
                labelStyle: TextStyle(color: subtextColor, fontSize: 12),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF6366F1)),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: subtextColor)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final val = int.tryParse(controller.text) ?? 7;
              final prefs = await SharedPreferences.getInstance();
              await prefs.setInt('lead_holding_period', val);
              setState(() {
                _leadHoldingPeriod = val;
              });
              if (mounted) Navigator.pop(context);
            },
            child: const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showShiftCompleteDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 28),
            const SizedBox(width: 10),
            Text(
              'Shift Completed!',
              style: TextStyle(color: textColor, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Text(
          'Your 8-hour login hours are complete for today. Excellent work! Please log out to end your day.',
          style: TextStyle(color: subtextColor, fontSize: 14, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(context);
              ApiService.logout();
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                );
              }
            },
            child: const Text(
              'End Shift & Logout',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _uiRefreshTimer?.cancel();
    _syncTimer?.cancel();
    super.dispose();
  }

  String _formatDuration(int totalSeconds) {
    final int h = totalSeconds ~/ 3600;
    final int m = (totalSeconds % 3600) ~/ 60;
    
    return '${h}h ${m}m';
  }





  void _handleSessionToggle() {
    if (!_telemetry.isActive) {
      _telemetry.startSession();
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const CallingScreen()),
      );
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const CallingScreen()),
      );
    }
  }

  Future<void> _handleLogout() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF12131A) : Colors.white,
        title: Text('End Work Day?', style: TextStyle(color: textColor)),
        content: Text(
          'This will stop tracking your timers and sign you out of your account.',
          style: TextStyle(color: subtextColor),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: subtextColor)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              ApiService.logout();
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                );
              }
            },
            child: const Text('End & Logout', style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
  }

  void _showAddLeadDialog() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: Color(0xFF6366F1)),
      ),
    );

    List<dynamic> campaigns = [];
    try {
      campaigns = await ApiService.fetchCampaigns();
    } catch (e) {
      print('Error fetching campaigns: $e');
    }

    if (mounted) {
      Navigator.pop(context); // Close loading spinner
    }

    if (campaigns.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No active campaigns found. Please contact admin.')),
        );
      }
      return;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    int? selectedCampaignId = campaigns.isNotEmpty ? campaigns[0]['id'] : null;

    if (mounted) {
      showDialog(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: cardColor,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text(
              'Add Lead to Campaign',
              style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            content: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<int>(
                      dropdownColor: cardColor,
                      value: selectedCampaignId,
                      decoration: InputDecoration(
                        labelText: 'Select Campaign',
                        labelStyle: TextStyle(color: subtextColor, fontSize: 12),
                        enabledBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: subtextColor.withOpacity(0.5)),
                        ),
                      ),
                      style: TextStyle(color: textColor),
                      items: campaigns.map<DropdownMenuItem<int>>((camp) {
                        return DropdownMenuItem<int>(
                          value: camp['id'],
                          child: Text(camp['name'] ?? 'Campaign'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setDialogState(() {
                          selectedCampaignId = val;
                        });
                      },
                      validator: (value) => value == null ? 'Campaign is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: nameController,
                      style: TextStyle(color: textColor),
                      decoration: InputDecoration(
                        labelText: 'Lead Name',
                        labelStyle: TextStyle(color: subtextColor, fontSize: 12),
                        enabledBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: subtextColor.withOpacity(0.5)),
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Name is required';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: phoneController,
                      style: TextStyle(color: textColor),
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Phone Number',
                        labelStyle: TextStyle(color: subtextColor, fontSize: 12),
                        enabledBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: subtextColor.withOpacity(0.5)),
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Phone number is required';
                        }
                        final clean = value.replaceAll(RegExp(r'\D'), '');
                        if (clean.length < 8) {
                          return 'Enter a valid phone number';
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
                onPressed: () => Navigator.pop(context),
                child: Text('Cancel', style: TextStyle(color: subtextColor)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () async {
                  if (formKey.currentState!.validate()) {
                    showDialog(
                      context: context,
                      barrierDismissible: false,
                      builder: (ctx) => const Center(
                        child: CircularProgressIndicator(color: Color(0xFF6366F1)),
                      ),
                    );

                    final res = await ApiService.addLead(
                      campaignId: selectedCampaignId!,
                      name: nameController.text.trim(),
                      phoneNumber: phoneController.text.trim(),
                    );

                    if (mounted) {
                      Navigator.pop(context); // pop loading
                    }

                    if (res['success'] == true) {
                      if (mounted) {
                        Navigator.pop(context); // pop add dialog
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Lead added successfully.')),
                        );
                      }
                    } else {
                      if (mounted) {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: cardColor,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            title: Row(
                              children: [
                                const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 24),
                                const SizedBox(width: 8),
                                Text('Conflict Detected', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 16)),
                              ],
                            ),
                            content: Text(
                              res['error'] ?? 'Lead could not be added.',
                              style: TextStyle(color: textColor, fontSize: 14),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: const Text('OK', style: TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                        );
                      }
                    }
                  }
                },
                child: const Text('Add Lead', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }
  }

  Future<void> _loadProfileData() async {
    setState(() {
      _loadingProfile = true;
    });
    try {
      final user = await ApiService.fetchMe();
      if (user != null) {
        setState(() {
          _profileUser = user;
          _profileNameController.text = user['name'] ?? '';
        });
      }
    } catch (e) {
      print('Error loading profile: $e');
    } finally {
      setState(() {
        _loadingProfile = false;
      });
    }
  }

  Future<void> _pickProfileImage() async {
    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 500,
        maxHeight: 500,
        imageQuality: 80,
      );
      if (pickedFile != null) {
        setState(() {
          _profileImagePath = pickedFile.path;
        });
      }
    } catch (e) {
      print('Error picking image: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to pick image: $e')),
      );
    }
  }

  Future<void> _updateProfile() async {
    if (_profileNameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name cannot be empty')),
      );
      return;
    }

    setState(() {
      _loadingProfile = true;
    });

    try {
      final result = await ApiService.updateProfile(
        name: _profileNameController.text.trim(),
        imagePath: _profileImagePath.isNotEmpty ? _profileImagePath : null,
      );

      if (result['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'] ?? 'Profile updated successfully')),
        );
        setState(() {
          _profileImagePath = ''; // Clear temporary path
        });
        await _loadProfileData(); // Reload updated profile
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['error'] ?? 'Failed to update profile')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() {
        _loadingProfile = false;
      });
    }
  }

  Future<void> _loadLeadManagerData() async {
    if (!mounted) return;
    setState(() {
      _loadingContacts = true;
      _loadingTransfers = true;
    });

    try {
      final contacts = await ApiService.fetchAllottedContacts();
      final transfers = await ApiService.fetchTransferRequests();
      final colleagues = await ApiService.fetchColleagues();

      if (mounted) {
        setState(() {
          _allottedContacts = contacts;
          _transferRequests = transfers;
          _colleagues = colleagues;
        });
      }
    } catch (e) {
      print('Error loading Lead Manager data: $e');
    } finally {
      if (mounted) {
        setState(() {
          _loadingContacts = false;
          _loadingTransfers = false;
        });
      }
    }
  }

  Future<void> _submitTransferRequest(int contactId) async {
    if (_selectedColleagueId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a colleague')),
      );
      return;
    }

    try {
      final result = await ApiService.requestLeadTransfer(
        contactId: contactId,
        toUserId: _selectedColleagueId!,
        reason: _transferReasonController.text.trim(),
      );

      if (result['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'])),
        );
        _transferReasonController.clear();
        _selectedColleagueId = null;
        Navigator.pop(context);
        await _loadLeadManagerData(); // Reload lists
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['error'])),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  Future<void> _respondToTransfer(int transferId, String status) async {
    setState(() {
      _loadingTransfers = true;
    });

    try {
      final result = await ApiService.respondToTransferRequest(
        transferId: transferId,
        status: status,
      );

      if (result['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'])),
        );
        await _loadLeadManagerData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['error'])),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() {
        _loadingTransfers = false;
      });
    }
  }

  void _showTransferDialog(dynamic contact) {
    _transferReasonController.clear();
    _selectedColleagueId = null;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: cardColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Transfer Lead: ${contact['name']}',
            style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Container(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Select Target Colleague',
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 8),
                _colleagues.isEmpty
                    ? Text(
                        'No other colleagues available in this company.',
                        style: TextStyle(color: subtextColor, fontSize: 13),
                      )
                    : Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF9FAFB),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _selectedColleagueId,
                            dropdownColor: cardColor,
                            hint: Text('Choose a telecaller', style: TextStyle(color: subtextColor, fontSize: 14)),
                            isExpanded: true,
                            items: _colleagues.map<DropdownMenuItem<int>>((colleague) {
                              return DropdownMenuItem<int>(
                                value: colleague['id'],
                                child: Text(
                                  '${colleague['name']} (${colleague['email']})',
                                  style: TextStyle(color: textColor, fontSize: 14),
                                ),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setDialogState(() {
                                _selectedColleagueId = val;
                              });
                            },
                          ),
                        ),
                      ),
                const SizedBox(height: 16),
                Text(
                  'Reason for Transfer',
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _transferReasonController,
                  maxLines: 2,
                  style: TextStyle(color: textColor),
                  decoration: InputDecoration(
                    hintText: 'Enter reason...',
                    hintStyle: TextStyle(color: subtextColor, fontSize: 13),
                    filled: true,
                    fillColor: isDark ? const Color(0xFF1E293B).withOpacity(0.3) : const Color(0xFFF9FAFB),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel', style: TextStyle(color: subtextColor)),
            ),
            ElevatedButton(
              onPressed: _selectedColleagueId == null
                  ? null
                  : () => _submitTransferRequest(contact['id']),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Submit Request', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showChangePasswordDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool obscureCurrent = true;
    bool obscureNew = true;
    bool obscureConfirm = true;
    bool loading = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: isDark ? const Color(0xFF12131A) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Change Password',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: currentPasswordController,
                    obscureText: obscureCurrent,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      labelText: 'Current Password',
                      labelStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      suffixIcon: IconButton(
                        icon: Icon(
                          obscureCurrent ? Icons.visibility_off : Icons.visibility,
                          color: const Color(0xFF6366F1),
                        ),
                        onPressed: () => setDialogState(() => obscureCurrent = !obscureCurrent),
                      ),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[300]!),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFF6366F1)),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter current password';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: newPasswordController,
                    obscureText: obscureNew,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      labelText: 'New Password',
                      labelStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      suffixIcon: IconButton(
                        icon: Icon(
                          obscureNew ? Icons.visibility_off : Icons.visibility,
                          color: const Color(0xFF6366F1),
                        ),
                        onPressed: () => setDialogState(() => obscureNew = !obscureNew),
                      ),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[300]!),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFF6366F1)),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter new password';
                      }
                      if (value.trim().length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: confirmPasswordController,
                    obscureText: obscureConfirm,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black),
                    decoration: InputDecoration(
                      labelText: 'Confirm New Password',
                      labelStyle: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      suffixIcon: IconButton(
                        icon: Icon(
                          obscureConfirm ? Icons.visibility_off : Icons.visibility,
                          color: const Color(0xFF6366F1),
                        ),
                        onPressed: () => setDialogState(() => obscureConfirm = !obscureConfirm),
                      ),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[300]!),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFF6366F1)),
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please confirm new password';
                      }
                      if (value.trim() != newPasswordController.text.trim()) {
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
              onPressed: loading ? null : () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
              ),
            ),
            ElevatedButton(
              onPressed: loading
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setDialogState(() => loading = true);
                      
                      final result = await ApiService.changePassword(
                        currentPassword: currentPasswordController.text.trim(),
                        newPassword: newPasswordController.text.trim(),
                      );

                      setDialogState(() => loading = false);

                      if (context.mounted) {
                        if (result['success'] == true) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(result['message'] ?? 'Password changed successfully'),
                              backgroundColor: Colors.green,
                            ),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(result['error'] ?? 'Error changing password'),
                              backgroundColor: Colors.redAccent,
                            ),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text(
                      'Change',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTab(ResponsiveLayout layout, bool isDark) {
    switch (_currentTabIndex) {
      case 0:
        return _buildWorkspaceTab(layout, isDark);
      case 1:
        return _buildLeadManagerTab(layout, isDark);
      case 2:
        return _buildProfileTab(layout, isDark);
      case 3:
        return _buildSettingsTab(layout, isDark);
      default:
        return _buildWorkspaceTab(layout, isDark);
    }
  }

  Widget _buildLeadManagerTab(ResponsiveLayout layout, bool isDark) {
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    if (_loadingContacts && _allottedContacts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    final addedLeads = _allottedContacts
        .where((c) => c['added_by'] != null && c['added_by'] == (_profileUser?['id'] ?? -1))
        .toList();

    final followUpLeads = _allottedContacts
        .where((c) => c['status'] == 'follow_up')
        .toList();

    return DefaultTabController(
      length: 4,
      child: Column(
        children: [
          TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: const Color(0xFF6366F1),
            unselectedLabelColor: subtextColor,
            indicatorColor: const Color(0xFF6366F1),
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            tabs: const [
              Tab(text: 'Added Leads'),
              Tab(text: 'Follow Ups'),
              Tab(text: 'Transfers'),
              Tab(text: 'All Leads'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildLeadList(addedLeads, layout, isDark, showTransferBtn: true),
                _buildLeadList(followUpLeads, layout, isDark, showFollowUpInfo: true),
                _buildTransfersView(layout, isDark),
                _buildAllLeadsTab(layout, isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeadList(
    List<dynamic> leads,
    ResponsiveLayout layout,
    bool isDark, {
    bool showTransferBtn = false,
    bool showFollowUpInfo = false,
  }) {
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    if (leads.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_late_rounded, size: 48, color: subtextColor.withOpacity(0.5)),
            const SizedBox(height: 12),
            Text(
              'No leads found',
              style: TextStyle(color: subtextColor, fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: leads.length,
      itemBuilder: (context, index) {
        final lead = leads[index];
        final String name = lead['name'] ?? 'Unknown';
        final String phone = lead['phone_number'] ?? '';
        final String campaign = lead['campaign_name'] ?? 'General';
        final String status = lead['status'] ?? 'pending';

        String followUpTime = '';
        if (showFollowUpInfo && lead['follow_up_date'] != null) {
          try {
            final date = DateTime.parse(lead['follow_up_date'].toString()).toLocal();
            final day = date.day.toString().padLeft(2, '0');
            final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            final month = months[date.month - 1];
            final hour = date.hour > 12 ? date.hour - 12 : (date.hour == 0 ? 12 : date.hour);
            final min = date.minute.toString().padLeft(2, '0');
            final ampm = date.hour >= 12 ? 'PM' : 'AM';
            followUpTime = '$day $month, $hour:$min $ampm';
          } catch (_) {
            followUpTime = lead['follow_up_date'].toString();
          }
        }

        return Card(
          color: cardColor,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
          ),
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        phone,
                        style: TextStyle(color: subtextColor, fontSize: 12),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'Campaign: $campaign',
                              style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[700], fontSize: 11),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: lead['added_by'] != null && lead['added_by'] == (_profileUser?['id'] ?? -1)
                                  ? const Color(0x1F10B981)
                                  : const Color(0x1F3B82F6),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              lead['added_by'] != null && lead['added_by'] == (_profileUser?['id'] ?? -1)
                                  ? 'ADDED BY OWN'
                                  : 'ALLOTTED',
                              style: TextStyle(
                                color: lead['added_by'] != null && lead['added_by'] == (_profileUser?['id'] ?? -1)
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF3B82F6),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: status == 'follow_up'
                                  ? const Color(0x20A855F7)
                                  : (status == 'calling' ? const Color(0x2010B981) : const Color(0x206366F1)),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              status.replaceAll('_', ' ').toUpperCase(),
                              style: TextStyle(
                                color: status == 'follow_up'
                                    ? const Color(0xFFA855F7)
                                    : (status == 'calling' ? const Color(0xFF10B981) : const Color(0xFF6366F1)),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (showFollowUpInfo && followUpTime.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.alarm_on_rounded, size: 14, color: Color(0xFFA855F7)),
                            const SizedBox(width: 4),
                            Text(
                              'Follow Up: $followUpTime',
                              style: const TextStyle(color: Color(0xFFA855F7), fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                if (showTransferBtn)
                  IconButton(
                    icon: const Icon(Icons.swap_horiz_rounded, color: Color(0xFF6366F1)),
                    tooltip: 'Transfer Lead',
                    onPressed: () => _showTransferDialog(lead),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTransfersView(ResponsiveLayout layout, bool isDark) {
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    if (_loadingTransfers && _transferRequests.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    final incoming = _transferRequests
        .where((t) => t['to_user_name'] == (_profileUser?['name'] ?? ''))
        .toList();

    final outgoing = _transferRequests
        .where((t) => t['from_user_name'] == (_profileUser?['name'] ?? ''))
        .toList();

    return RefreshIndicator(
      onRefresh: _loadLeadManagerData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'INCOMING TRANSFER APPROVALS',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: subtextColor, letterSpacing: 1.0),
            ),
            const SizedBox(height: 8),
            if (incoming.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text('No incoming transfer requests', style: TextStyle(color: subtextColor, fontSize: 13)),
                ),
              )
            else
              ...incoming.map((req) => _buildTransferRequestCard(req, isIncoming: true, isDark: isDark)),
            
            const SizedBox(height: 20),
            Text(
              'OUTGOING TRANSFER REQUESTS',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: subtextColor, letterSpacing: 1.0),
            ),
            const SizedBox(height: 8),
            if (outgoing.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text('No outgoing transfer requests', style: TextStyle(color: subtextColor, fontSize: 13)),
                ),
              )
            else
              ...outgoing.map((req) => _buildTransferRequestCard(req, isIncoming: false, isDark: isDark)),
          ],
        ),
      ),
    );
  }

  Widget _buildTransferRequestCard(dynamic req, {required bool isIncoming, required bool isDark}) {
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    final int transferId = req['id'];
    final String contactName = req['contact_name'] ?? 'Unknown Lead';
    final String contactPhone = req['contact_phone'] ?? '';
    final String fromUser = req['from_user_name'] ?? 'Someone';
    final String toUser = req['to_user_name'] ?? 'Someone';
    final String status = req['status'] ?? 'pending';
    final String reason = req['reason'] ?? '';

    Color statusColor;
    if (status == 'approved') {
      statusColor = const Color(0xFF10B981);
    } else if (status == 'rejected') {
      statusColor = const Color(0xFFEF4444);
    } else {
      statusColor = const Color(0xFFF59E0B);
    }

    return Card(
      color: cardColor,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
      ),
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  contactName,
                  style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              contactPhone,
              style: TextStyle(color: subtextColor, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Text(
              isIncoming ? 'From: $fromUser' : 'To: $toUser',
              style: TextStyle(color: textColor, fontSize: 12, fontWeight: FontWeight.w500),
            ),
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Reason: "$reason"',
                style: TextStyle(color: subtextColor, fontSize: 11, fontStyle: FontStyle.italic),
              ),
            ],
            if (isIncoming && status == 'pending') ...[
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => _respondToTransfer(transferId, 'rejected'),
                    style: TextButton.styleFrom(foregroundColor: Colors.red),
                    child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () => _respondToTransfer(transferId, 'approved'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    child: const Text('Approve', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAllLeadsTab(ResponsiveLayout layout, bool isDark) {
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    final filtered = _allottedContacts.where((lead) {
      final name = lead['name']?.toString().toLowerCase() ?? '';
      final phone = lead['phone_number']?.toString() ?? '';
      final term = _searchQuery.toLowerCase();
      return name.contains(term) || phone.contains(term);
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            style: TextStyle(color: textColor),
            onChanged: (val) {
              setState(() {
                _searchQuery = val;
              });
            },
            decoration: InputDecoration(
              hintText: 'Search leads...',
              hintStyle: TextStyle(color: subtextColor, fontSize: 14),
              prefixIcon: const Icon(Icons.search, size: 20),
              filled: true,
              fillColor: isDark ? const Color(0xFF12131A) : Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF6366F1)),
              ),
            ),
          ),
        ),
        Expanded(
          child: _buildLeadList(filtered, layout, isDark, showTransferBtn: true),
        ),
      ],
    );
  }

  Widget _buildProfileTab(ResponsiveLayout layout, bool isDark) {
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    if (_loadingProfile && _profileUser == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final user = _profileUser ?? {};
    final String photoUrl = user['profile_photo'] ?? '';
    final String name = user['name'] ?? '';
    final String email = user['email'] ?? '';
    final String role = user['role'] ?? 'telecaller';
    final String companyRegNum = user['companyRegNum'] ?? '';

    ImageProvider avatarImage;
    if (_profileImagePath.isNotEmpty) {
      avatarImage = FileImage(File(_profileImagePath));
    } else if (photoUrl.isNotEmpty) {
      avatarImage = NetworkImage('${ApiService.baseUrl}$photoUrl');
    } else {
      avatarImage = const AssetImage('assets/logo_transparent.png');
    }

    return SingleChildScrollView(
      padding: EdgeInsets.all(layout.scale(16.0, 20.0)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Stack(
              children: [
                Container(
                  width: layout.scale(100.0, 120.0),
                  height: layout.scale(100.0, 120.0),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF3F4F6),
                    border: Border.all(
                      color: const Color(0xFF6366F1),
                      width: 3,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6366F1).withOpacity(0.2),
                        blurRadius: 10,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: photoUrl.isNotEmpty || _profileImagePath.isNotEmpty
                        ? Image(
                            image: avatarImage,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              return Center(
                                child: Text(
                                  name.isNotEmpty ? name[0].toUpperCase() : 'U',
                                  style: TextStyle(
                                    fontSize: layout.scale(32.0, 40.0),
                                    fontWeight: FontWeight.bold,
                                    color: const Color(0xFF6366F1),
                                  ),
                                ),
                              );
                            },
                          )
                        : Center(
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : 'U',
                              style: TextStyle(
                                  fontSize: layout.scale(32.0, 40.0),
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF6366F1)),
                            ),
                          ),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: _pickProfileImage,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF6366F1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.camera_alt_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: EdgeInsets.all(layout.scale(16.0, 20.0)),
            decoration: BoxDecoration(
              color: cardColor,
              borderRadius: BorderRadius.circular(layout.cardRadius),
              border: Border.all(
                color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB),
                width: 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Name',
                  style: TextStyle(color: subtextColor, fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _profileNameController,
                  style: TextStyle(color: textColor, fontWeight: FontWeight.w500),
                  decoration: InputDecoration(
                    hintText: 'Enter your name',
                    hintStyle: TextStyle(color: subtextColor),
                    filled: true,
                    fillColor: isDark ? const Color(0xFF1E293B).withOpacity(0.3) : const Color(0xFFF9FAFB),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFF6366F1)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Mobile Number',
                  style: TextStyle(color: subtextColor, fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  initialValue: email,
                  readOnly: true,
                  style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w500),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: isDark ? const Color(0xFF11131E) : const Color(0xFFF3F4F6),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Role',
                            style: TextStyle(color: subtextColor, fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: role.toUpperCase(),
                            readOnly: true,
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w500),
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: isDark ? const Color(0xFF11131E) : const Color(0xFFF3F4F6),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Company Code',
                            style: TextStyle(color: subtextColor, fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            initialValue: companyRegNum,
                            readOnly: true,
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w500),
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: isDark ? const Color(0xFF11131E) : const Color(0xFFF3F4F6),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _loadingProfile ? null : _updateProfile,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(layout.cardRadius),
              ),
            ),
            child: _loadingProfile
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text(
                    'Update Profile',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTab(ResponsiveLayout layout, bool isDark) {
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return SingleChildScrollView(
      padding: EdgeInsets.all(layout.scale(12.0, 16.0)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildSimSelectionCard(),
          SizedBox(height: layout.spacing),
          Container(
            decoration: BoxDecoration(
              color: cardColor,
              borderRadius: BorderRadius.circular(layout.cardRadius),
              border: Border.all(
                color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB),
                width: 1,
              ),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: Icon(
                    isDark ? Icons.light_mode_rounded : Icons.dark_mode_outlined,
                    color: isDark ? Colors.amber : const Color(0xFF6366F1),
                  ),
                  title: Text(
                    isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
                    style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
                  ),
                  trailing: Switch(
                    value: isDark,
                    activeColor: const Color(0xFF6366F1),
                    onChanged: (val) async {
                      final prefs = await SharedPreferences.getInstance();
                      if (val) {
                        themeNotifier.value = ThemeMode.dark;
                        await prefs.setBool('is_light_theme', false);
                      } else {
                        themeNotifier.value = ThemeMode.light;
                        await prefs.setBool('is_light_theme', true);
                      }
                      setState(() {});
                    },
                  ),
                ),
                Divider(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB), height: 1),
                ListTile(
                  leading: const Icon(Icons.timer_rounded, color: Color(0xFF6366F1)),
                  title: Text(
                    'Lead Holding Period',
                    style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
                  ),
                  trailing: Text(
                    '$_leadHoldingPeriod Days',
                    style: TextStyle(color: subtextColor, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  onTap: _showLeadHoldingPeriodDialog,
                ),
                Divider(color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB), height: 1),
                ListTile(
                  leading: const Icon(Icons.power_settings_new_rounded, color: Colors.redAccent),
                  title: Text(
                    'Log Out',
                    style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600),
                  ),
                  onTap: _handleLogout,
                ),
              ],
            ),
          ),
          SizedBox(height: layout.spacing),
          Center(
            child: Text(
              'Eazzio Telecaller v1.0.0',
              style: TextStyle(color: subtextColor, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkspaceTab(ResponsiveLayout layout, bool isDark) {
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF94A3B8);
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight,
            ),
            child: IntrinsicHeight(
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: layout.scale(12.0, 16.0),
                  vertical: layout.scale(8.0, 12.0),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'TELEMETRY METRICS',
                          style: TextStyle(
                            fontSize: layout.fontSizeCaption,
                            fontWeight: FontWeight.bold,
                            color: mutedColor,
                            letterSpacing: 1.0,
                          ),
                        ),
                        SizedBox(height: layout.scale(8.0, 10.0)),
                        Row(
                          children: [
                            Expanded(
                              child: _buildTimerCard(
                                title: 'Work Time',
                                value: _formatDuration(_telemetry.workingTime),
                                target: '8h',
                                progress: _telemetry.workingTime / 28800,
                                valueColor: const Color(0xFF6366F1),
                                icon: Icons.access_time_rounded,
                                context: context,
                              ),
                            ),
                            SizedBox(width: layout.scale(8.0, 12.0)),
                            Expanded(
                              child: _buildTimerCard(
                                title: 'Talk Time',
                                value: _formatDuration(_telemetry.talkTime),
                                target: '4h',
                                progress: _telemetry.talkTime / 14400,
                                valueColor: const Color(0xFF10B981),
                                icon: Icons.phone_in_talk_rounded,
                                context: context,
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: layout.scale(8.0, 12.0)),
                        _buildTimerCard(
                          title: 'Break Time',
                          value: _formatDuration(_telemetry.breakTime),
                          target: '2h',
                          progress: _telemetry.breakTime / 7200,
                          valueColor: const Color(0xFFA855F7),
                          icon: Icons.coffee_rounded,
                          context: context,
                        ),
                      ],
                    ),
                    SizedBox(height: layout.spacing),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'CALL OUTCOMES TODAY',
                          style: TextStyle(
                            fontSize: layout.fontSizeCaption,
                            fontWeight: FontWeight.bold,
                            color: mutedColor,
                            letterSpacing: 1.0,
                          ),
                        ),
                        SizedBox(height: layout.scale(8.0, 10.0)),
                        Column(
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: _buildCallCounter(
                                    label: 'Connected',
                                    count: _telemetry.connectedCalls,
                                    baseColor: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                                    badgeBgColor: isDark ? const Color(0x1A34D399) : const Color(0xFFE6F4EA),
                                    icon: Icons.phone_callback_rounded,
                                    context: context,
                                    isDark: isDark,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _buildCallCounter(
                                    label: 'Non-Connected',
                                    count: _telemetry.nonConnectedCalls,
                                    baseColor: isDark ? const Color(0xFFFB923C) : const Color(0xFFD97706),
                                    badgeBgColor: isDark ? const Color(0x1AFB923C) : const Color(0xFFFEF3C7),
                                    icon: Icons.phone_paused_rounded,
                                    context: context,
                                    isDark: isDark,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildCallCounter(
                                    label: 'Received',
                                    count: _telemetry.receivedCalls,
                                    baseColor: isDark ? const Color(0xFF38BDF8) : const Color(0xFF0284C7),
                                    badgeBgColor: isDark ? const Color(0x1A38BDF8) : const Color(0xFFE0F2FE),
                                    icon: Icons.call_received_rounded,
                                    context: context,
                                    isDark: isDark,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _buildCallCounter(
                                    label: 'Missed',
                                    count: _telemetry.missedCalls,
                                    baseColor: isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626),
                                    badgeBgColor: isDark ? const Color(0x1AF87171) : const Color(0xFFFEE2E2),
                                    icon: Icons.call_missed_rounded,
                                    context: context,
                                    isDark: isDark,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    const Spacer(),
                    SizedBox(height: layout.spacing),
                    Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF6366F1), Color(0xFF7C3AED)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                        borderRadius: BorderRadius.circular(layout.cardRadius),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF6366F1).withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _handleSessionToggle,
                        style: ElevatedButton.styleFrom(
                          padding: EdgeInsets.symmetric(vertical: layout.scale(12.0, 16.0)),
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(layout.cardRadius),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              _telemetry.isActive ? Icons.play_arrow_rounded : Icons.play_circle_filled_rounded,
                              color: Colors.white,
                              size: layout.scale(20.0, 24.0),
                            ),
                            SizedBox(width: layout.scale(6.0, 8.0)),
                            Text(
                              _telemetry.isActive ? 'Open Calling Workspace' : 'Start Calling Session',
                              style: TextStyle(
                                fontSize: layout.fontSizeHeading,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0B10) : const Color(0xFFF5F6FC);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          _currentTabIndex == 0
              ? 'Caller Dashboard'
              : (_currentTabIndex == 1
                  ? 'Lead Manager'
                  : (_currentTabIndex == 2 ? 'My Profile' : 'Settings')),
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: textColor,
            fontSize: layout.fontSizeTitle,
          ),
        ),
        actions: _currentTabIndex == 0
            ? [
                Container(
                  margin: EdgeInsets.only(right: layout.scale(12.0, 16.0)),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDark ? const Color(0xFF222435) : const Color(0xFFE2E8F0),
                      width: 1.5,
                    ),
                    color: cardColor,
                  ),
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      cardColor: cardColor,
                    ),
                    child: PopupMenuButton<String>(
                      icon: Icon(
                        Icons.settings,
                        color: isDark ? Colors.white : const Color(0xFF64748B),
                        size: layout.scale(18.0, 20.0),
                      ),
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(
                        minWidth: layout.scale(36.0, 40.0),
                        minHeight: layout.scale(36.0, 40.0),
                      ),
                      onSelected: (val) async {
                        if (val == 'theme') {
                          final prefs = await SharedPreferences.getInstance();
                          if (themeNotifier.value == ThemeMode.dark) {
                            themeNotifier.value = ThemeMode.light;
                            await prefs.setBool('is_light_theme', true);
                          } else {
                            themeNotifier.value = ThemeMode.dark;
                            await prefs.setBool('is_light_theme', false);
                          }
                          setState(() {});
                        } else if (val == 'add_lead') {
                          _showAddLeadDialog();
                        } else if (val == 'logout') {
                          _handleLogout();
                        }
                      },
                      itemBuilder: (context) => [
                        PopupMenuItem(
                          value: 'theme',
                          child: Row(
                            children: [
                              Icon(
                                themeNotifier.value == ThemeMode.dark ? Icons.light_mode_rounded : Icons.dark_mode_outlined,
                                color: isDark ? Colors.amber : const Color(0xFF64748B),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                themeNotifier.value == ThemeMode.dark ? 'Light Mode' : 'Dark Mode',
                                style: TextStyle(color: textColor),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'add_lead',
                          child: Row(
                            children: [
                              const Icon(Icons.person_add_alt_1_rounded, color: Colors.blue),
                              const SizedBox(width: 10),
                              Text(
                                'Add Lead',
                                style: TextStyle(color: textColor),
                              ),
                            ],
                          ),
                        ),
                        const PopupMenuDivider(),
                        PopupMenuItem(
                          value: 'logout',
                          child: const Row(
                            children: [
                              Icon(Icons.power_settings_new_rounded, color: Colors.red),
                              const SizedBox(width: 10),
                              Text('Logout', style: TextStyle(color: Colors.red)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ]
            : (_currentTabIndex == 1
                ? [
                    IconButton(
                      icon: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFF6366F1)),
                      tooltip: 'Add Lead',
                      onPressed: _showAddLeadDialog,
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded, color: Color(0xFF6366F1)),
                      tooltip: 'Refresh',
                      onPressed: _loadLeadManagerData,
                    ),
                  ]
                : null),
      ),
      body: SafeArea(
        child: _buildActiveTab(layout, isDark),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF12131A) : Colors.white,
          border: Border(
            top: BorderSide(
              color: isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB),
              width: 1,
            ),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentTabIndex,
          onTap: (index) {
            setState(() {
              _currentTabIndex = index;
            });
            if (index == 1) {
              _loadLeadManagerData();
            } else if (index == 2) {
              _loadProfileData();
            }
          },
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF6366F1),
          unselectedItemColor: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.normal, fontSize: 11),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_rounded),
              activeIcon: Icon(Icons.dashboard_rounded, color: Color(0xFF6366F1)),
              label: 'Workspace',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_alt_rounded),
              activeIcon: Icon(Icons.people_alt_rounded, color: Color(0xFF6366F1)),
              label: 'Lead Manager',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              activeIcon: Icon(Icons.person_rounded, color: Color(0xFF6366F1)),
              label: 'Profile',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_rounded),
              activeIcon: Icon(Icons.settings_rounded, color: Color(0xFF6366F1)),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }




  Widget _buildTimerCard({
    required String title,
    required String value,
    required String target,
    required double progress,
    required Color valueColor,
    required IconData icon,
    required BuildContext context,
  }) {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF);

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(layout.cardRadius),
        border: Border.all(
          color: isDark ? borderColor : valueColor.withOpacity(0.12),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(layout.cardRadius),
        child: Stack(
          children: [
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(
                width: 5,
                color: valueColor,
              ),
            ),
            Padding(
              padding: EdgeInsets.only(
                left: layout.scale(12.0, 16.0) + 5,
                right: layout.scale(12.0, 16.0),
                top: layout.scale(12.0, 16.0),
                bottom: layout.scale(12.0, 16.0),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                            fontSize: layout.fontSizeHeading - 2,
                            fontWeight: FontWeight.bold,
                          ),
                         ),
                      ),
                      const SizedBox(width: 4),
                      Container(
                        padding: EdgeInsets.all(layout.scale(4.0, 6.0)),
                        decoration: BoxDecoration(
                          color: valueColor.withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, color: valueColor, size: layout.scale(14.0, 16.0)),
                      ),
                    ],
                  ),
                  SizedBox(height: layout.scale(8.0, 12.0)),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: RichText(
                      text: TextSpan(
                        children: [
                          TextSpan(
                            text: value,
                            style: TextStyle(
                              color: valueColor,
                              fontSize: layout.scale(20.0, 24.0),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          TextSpan(
                            text: ' / ',
                            style: TextStyle(
                              color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                              fontSize: layout.scale(12.0, 14.0),
                              fontWeight: FontWeight.normal,
                            ),
                          ),
                          TextSpan(
                            text: target,
                            style: TextStyle(
                              color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                              fontSize: layout.scale(12.0, 14.0),
                              fontWeight: FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: layout.scale(8.0, 12.0)),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      minHeight: 2,
                      backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFEEF2FF),
                      valueColor: AlwaysStoppedAnimation<Color>(valueColor),
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

  Widget _buildCallCounter({
    required String label,
    required int count,
    required Color baseColor,
    required Color badgeBgColor,
    required IconData icon,
    required BuildContext context,
    required bool isDark,
  }) {
    final layout = ResponsiveLayout(context);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;

    return Container(
      padding: EdgeInsets.symmetric(
        vertical: layout.scale(10.0, 14.0),
        horizontal: layout.scale(8.0, 12.0),
      ),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(layout.cardRadius),
        border: Border.all(
          color: baseColor.withOpacity(0.50),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: layout.scale(8.0, 10.0),
              vertical: layout.scale(4.0, 5.0),
            ),
            decoration: BoxDecoration(
              color: badgeBgColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    color: baseColor,
                    size: layout.scale(11.0, 14.0),
                  ),
                  SizedBox(width: layout.scale(4.0, 6.0)),
                  Text(
                    label,
                    style: TextStyle(
                      color: baseColor,
                      fontSize: layout.scale(9.0, 11.0),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: layout.scale(8.0, 12.0)),
          Text(
            count.toString(),
            style: TextStyle(
              color: baseColor,
              fontSize: layout.fontSizeLargeCount,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
