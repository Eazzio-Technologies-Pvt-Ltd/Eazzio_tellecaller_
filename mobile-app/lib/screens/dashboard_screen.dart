import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
  Timer? _uiRefreshTimer;
  Timer? _syncTimer;
  bool _isSyncing = false;
  List<Map<String, dynamic>> _availableSims = [];
  bool _loadingSims = false;

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
          color: isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF),
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
    }

    // Run first call log sync and start periodic timer
    _syncCallLogs();
    _syncTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      if (mounted) {
        _syncCallLogs();
      }
    });
  }

  void _checkShiftCompletion() {
    if (_telemetry.workingTime >= 28800 && !_telemetry.shiftCompleteShown) {
      _telemetry.shiftCompleteShown = true;
      _showShiftCompleteDialog();
    }
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
              _telemetry.stopSession();
              await ApiService.logout();
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
              _telemetry.stopSession();
              await ApiService.logout();
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

  @override
  Widget build(BuildContext context) {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0B10) : const Color(0xFFF5F6FC);
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFEEF2FF);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF94A3B8);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Caller Dashboard',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: textColor,
            fontSize: layout.fontSizeTitle,
          ),
        ),
        actions: [
          Container(
            margin: EdgeInsets.only(right: layout.scale(6.0, 8.0)),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isDark ? const Color(0xFF222435) : const Color(0xFFE2E8F0),
                width: 1.5,
              ),
              color: cardColor,
            ),
            child: IconButton(
              icon: Icon(
                themeNotifier.value == ThemeMode.dark ? Icons.light_mode_rounded : Icons.dark_mode_outlined,
                color: isDark ? Colors.amber : const Color(0xFF64748B),
                size: layout.scale(18.0, 20.0),
              ),
              onPressed: () async {
                final prefs = await SharedPreferences.getInstance();
                if (themeNotifier.value == ThemeMode.dark) {
                  themeNotifier.value = ThemeMode.light;
                  await prefs.setBool('is_light_theme', true);
                } else {
                  themeNotifier.value = ThemeMode.dark;
                  await prefs.setBool('is_light_theme', false);
                }
                setState(() {});
              },
              tooltip: 'Toggle Theme',
              padding: EdgeInsets.zero,
              constraints: BoxConstraints(
                minWidth: layout.scale(36.0, 40.0),
                minHeight: layout.scale(36.0, 40.0),
              ),
            ),
          ),
          Container(
            margin: EdgeInsets.only(right: layout.scale(12.0, 16.0)),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isDark ? const Color(0xFF881337) : const Color(0xFFFEE2E2),
                width: 1.5,
              ),
              color: isDark ? const Color(0xFF4C0519) : const Color(0xFFFEF2F2),
            ),
            child: IconButton(
              icon: Icon(
                Icons.power_settings_new_rounded,
                color: const Color(0xFFEF4444),
                size: layout.scale(18.0, 20.0),
              ),
              onPressed: _handleLogout,
              tooltip: 'Logout',
              padding: EdgeInsets.zero,
              constraints: BoxConstraints(
                minWidth: layout.scale(36.0, 40.0),
                minHeight: layout.scale(36.0, 40.0),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: layout.scale(12.0, 16.0),
            vertical: layout.scale(8.0, 12.0),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildSimSelectionCard(),
              SizedBox(height: layout.spacing),

              // Timers Row
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

              // Call Outcomes Card
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
                  Container(
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(layout.cardRadius),
                      border: Border.all(
                        color: isDark ? borderColor : const Color(0xFFEEF2FF),
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
                    child: Column(
                      children: [
                        IntrinsicHeight(
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildCallCounter(
                                  label: 'Connected',
                                  count: _telemetry.connectedCalls,
                                  baseColor: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                                  badgeBgColor: isDark ? const Color(0x1A34D399) : const Color(0xFFE6F4EA),
                                  icon: Icons.phone_callback_rounded,
                                  context: context,
                                ),
                              ),
                              VerticalDivider(
                                color: isDark ? borderColor : const Color(0xFFEEF2FF),
                                width: 1,
                                thickness: 1,
                              ),
                              Expanded(
                                child: _buildCallCounter(
                                  label: 'Non-Connected',
                                  count: _telemetry.nonConnectedCalls,
                                  baseColor: isDark ? const Color(0xFFFB923C) : const Color(0xFFD97706),
                                  badgeBgColor: isDark ? const Color(0x1AFB923C) : const Color(0xFFFEF3C7),
                                  icon: Icons.phone_paused_rounded,
                                  context: context,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Divider(
                          color: isDark ? borderColor : const Color(0xFFEEF2FF),
                          height: 1,
                          thickness: 1,
                        ),
                        IntrinsicHeight(
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildCallCounter(
                                  label: 'Received',
                                  count: _telemetry.receivedCalls,
                                  baseColor: isDark ? const Color(0xFF38BDF8) : const Color(0xFF0284C7),
                                  badgeBgColor: isDark ? const Color(0x1A38BDF8) : const Color(0xFFE0F2FE),
                                  icon: Icons.call_received_rounded,
                                  context: context,
                                ),
                              ),
                              VerticalDivider(
                                color: isDark ? borderColor : const Color(0xFFEEF2FF),
                                width: 1,
                                thickness: 1,
                              ),
                              Expanded(
                                child: _buildCallCounter(
                                  label: 'Missed',
                                  count: _telemetry.missedCalls,
                                  baseColor: isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626),
                                  badgeBgColor: isDark ? const Color(0x1AF87171) : const Color(0xFFFEE2E2),
                                  icon: Icons.call_missed_rounded,
                                  context: context,
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
              const Spacer(),

              // Core Action Button
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
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return Container(
      padding: EdgeInsets.all(layout.scale(12.0, 16.0)),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  fontSize: layout.fontSizeHeading - 2,
                  fontWeight: FontWeight.bold,
                ),
              ),
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
          RichText(
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
    );
  }

  Widget _buildCallCounter({
    required String label,
    required int count,
    required Color baseColor,
    required Color badgeBgColor,
    required IconData icon,
    required BuildContext context,
  }) {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.symmetric(
        vertical: layout.scale(14.0, 20.0),
        horizontal: layout.scale(4.0, 8.0),
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
            child: Row(
              mainAxisSize: MainAxisSize.min,
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
