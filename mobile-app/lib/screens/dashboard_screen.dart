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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final Color accentColor = const Color(0xFF6366F1);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? borderColor : accentColor.withOpacity(0.3), width: isDark ? 1 : 2),
        boxShadow: [
          BoxShadow(
            color: accentColor.withOpacity(isDark ? 0.03 : 0.05),
            blurRadius: isDark ? 4 : 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(Icons.sim_card_outlined, color: accentColor, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Calling SIM Option',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: subtextColor,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _callService.selectedSimLabel ?? 'Default Dialer (System Prompts)',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: textColor,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _loadingSims
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)),
                )
              : TextButton(
                  onPressed: _fetchAndSelectSim,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    backgroundColor: const Color(0x1F6366F1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text(
                    'Select SIM',
                    style: TextStyle(
                      color: Color(0xFF6366F1),
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Future<void> _syncCallLogs() async {
    if (_isSyncing || !ApiService.isAuthenticated) return;
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

      final List<dynamic>? logs = await channel.invokeMethod('getRecentCallLogs', {'limit': 50});
      if (logs == null || logs.isEmpty) {
        _isSyncing = false;
        return;
      }

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF);

    final statusColor = _telemetry.isActive ? const Color(0xFF10B981) : const Color(0xFF6B7280);
    final statusText = _telemetry.isActive ? 'ACTIVE SESSION' : 'OFFLINE';

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: cardColor,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Caller Dashboard',
          style: TextStyle(fontWeight: FontWeight.bold, color: textColor),
        ),
        actions: [
          IconButton(
            icon: Icon(
              themeNotifier.value == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
              color: subtextColor,
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
          ),
          IconButton(
            icon: const Icon(Icons.power_settings_new, color: Color(0xFFEF4444)),
            onPressed: _handleLogout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildSimSelectionCard(),
              const SizedBox(height: 16),

              // Timers Row
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'TELEMETRY METRICS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: mutedColor,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _buildTimerCard(
                          title: 'Work Time',
                          value: _formatDuration(_telemetry.workingTime),
                          target: '8h',
                          progress: _telemetry.workingTime / 28800,
                          valueColor: const Color(0xFF6366F1),
                          icon: Icons.timer,
                          context: context,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildTimerCard(
                          title: 'Talk Time',
                          value: _formatDuration(_telemetry.talkTime),
                          target: '4h',
                          progress: _telemetry.talkTime / 14400,
                          valueColor: const Color(0xFF10B981),
                          icon: Icons.phone_in_talk,
                          context: context,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildTimerCard(
                    title: 'Break Time',
                    value: _formatDuration(_telemetry.breakTime),
                    target: '2h',
                    progress: _telemetry.breakTime / 7200,
                    valueColor: const Color(0xFFA855F7),
                    icon: Icons.coffee,
                    context: context,
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Call Outcomes Card
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'CALL OUTCOMES TODAY',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: mutedColor,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
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
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            Expanded(
                              child: _buildCallCounter(
                                label: 'Connected',
                                count: _telemetry.connectedCalls,
                                color: const Color(0xFF10B981),
                                context: context,
                              ),
                            ),
                            Container(width: 1, height: 40, color: borderColor),
                            Expanded(
                              child: _buildCallCounter(
                                label: 'Non-Connected',
                                count: _telemetry.nonConnectedCalls,
                                color: const Color(0xFFF59E0B),
                                context: context,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Divider(color: borderColor, height: 1),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            Expanded(
                              child: _buildCallCounter(
                                label: 'Received',
                                count: _telemetry.receivedCalls,
                                color: const Color(0xFF06B6D4),
                                context: context,
                              ),
                            ),
                            Container(width: 1, height: 40, color: borderColor),
                            Expanded(
                              child: _buildCallCounter(
                                label: 'Missed',
                                count: _telemetry.missedCalls,
                                color: const Color(0xFFEF4444),
                                context: context,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Spacer(),

              // Core Action Button
              ElevatedButton(
                onPressed: _handleSessionToggle,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  backgroundColor: const Color(0xFF6366F1),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 6,
                  shadowColor: const Color(0x666366F1),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _telemetry.isActive ? Icons.play_arrow_outlined : Icons.play_circle_filled,
                      color: Colors.white,
                      size: 24,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _telemetry.isActive ? 'Open Calling Workspace' : 'Start Calling Session',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBreakTimeCard({
    required String value,
    required String target,
    required double progress,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF);
    const valueColor = Color(0xFFA855F7); // Purple

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? borderColor : valueColor.withOpacity(0.3), width: isDark ? 1 : 2),
        boxShadow: [
          BoxShadow(
            color: valueColor.withOpacity(isDark ? 0.03 : 0.05),
            blurRadius: isDark ? 4 : 6,
            offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Positioned(
              right: -20,
              bottom: -20,
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: valueColor.withOpacity(0.04),
                    width: 8,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Break Time',
                        style: TextStyle(
                          color: subtextColor,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: valueColor.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.coffee, color: valueColor, size: 18),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'BREAK DURATION (MAX 2H)',
                    style: TextStyle(color: mutedColor, fontSize: 10, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: value,
                          style: TextStyle(
                            color: valueColor,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextSpan(
                          text: ' / ',
                          style: TextStyle(
                            color: mutedColor,
                            fontSize: 14,
                            fontWeight: FontWeight.normal,
                          ),
                        ),
                        TextSpan(
                          text: target,
                          style: TextStyle(
                            color: mutedColor,
                            fontSize: 14,
                            fontWeight: FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      minHeight: 4,
                      backgroundColor: isDark ? const Color(0xFF1E1F29) : const Color(0xFFE5E7EB),
                      valueColor: const AlwaysStoppedAnimation<Color>(valueColor),
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

  Widget _buildTimerCard({
    required String title,
    required String value,
    required String target,
    required double progress,
    required Color valueColor,
    required IconData icon,
    required BuildContext context,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF);

    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? borderColor : valueColor.withOpacity(0.3), width: isDark ? 1 : 2),
        boxShadow: [
          BoxShadow(
            color: valueColor.withOpacity(isDark ? 0.03 : 0.05),
            blurRadius: isDark ? 4 : 6,
            offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Positioned(
              right: -15,
              bottom: -15,
              child: Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: valueColor.withOpacity(0.04),
                    width: 6,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            title,
                            style: TextStyle(
                              color: subtextColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 2),
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: valueColor.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, color: valueColor, size: 14),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
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
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          TextSpan(
                            text: ' / ',
                            style: TextStyle(
                              color: mutedColor,
                              fontSize: 10,
                              fontWeight: FontWeight.normal,
                            ),
                          ),
                          TextSpan(
                            text: target,
                            style: TextStyle(
                              color: mutedColor,
                              fontSize: 10,
                              fontWeight: FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      minHeight: 3,
                      backgroundColor: isDark ? const Color(0xFF1E1F29) : const Color(0xFFE5E7EB),
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
    required Color color,
    required BuildContext context,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    return Column(
      children: [
        Text(
          label,
          style: TextStyle(color: subtextColor, fontSize: 12, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 4),
        Text(
          count.toString(),
          style: TextStyle(color: color, fontSize: 26, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}
