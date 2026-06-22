import 'dart:async';
import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';
import 'package:eazzio_telecaller/screens/calling_screen.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final TelemetryService _telemetry = TelemetryService();
  Timer? _uiRefreshTimer;

  @override
  void initState() {
    super.initState();
    // Refresh stats UI every second to update active timer states
    _uiRefreshTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _uiRefreshTimer?.cancel();
    super.dispose();
  }

  String _formatDuration(int totalSeconds) {
    final int h = totalSeconds ~/ 3600;
    final int m = (totalSeconds % 3600) ~/ 60;
    
    return '${h.toString()}:${m.toString().padLeft(2, '0')}';
  }

  String _formatDurationWithTarget(int totalSeconds, String targetStr) {
    final int h = totalSeconds ~/ 3600;
    final int m = (totalSeconds % 3600) ~/ 60;
    
    final String running = '${h.toString()}:${m.toString().padLeft(2, '0')}';
    return '$running / $targetStr';
  }

  Widget _buildMergedBreakIdleCard({
    required String breakVal,
    required String idleVal,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF12131A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF222435)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Break Time',
                style: TextStyle(
                  color: Color(0xFF9CA3AF),
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Icon(Icons.coffee, color: Color(0xFFA855F7), size: 18),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'BREAK DURATION (MAX 2H)',
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 10, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    breakVal,
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'TOTAL IDLE TIME',
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 10, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    idleVal,
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
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
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF12131A),
        title: const Text('End Work Day?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'This will stop tracking your timers and sign you out of your account.',
          style: TextStyle(color: Color(0xFF9CA3AF)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF9CA3AF))),
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
    final statusColor = _telemetry.isActive ? const Color(0xFF10B981) : const Color(0xFF6B7280);
    final statusText = _telemetry.isActive ? 'ACTIVE SESSION' : 'OFFLINE';

    return Scaffold(
      backgroundColor: const Color(0xFF0A0B10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF12131A),
        elevation: 0,
        title: const Text(
          'Caller Dashboard',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.power_settings_new, color: Color(0xFFEF4444)),
            onPressed: _handleLogout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Session Status Card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF12131A),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF222435)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        if (_telemetry.isActive)
                          BoxShadow(
                            color: statusColor.withOpacity(0.5),
                            blurRadius: 8,
                            spreadRadius: 2,
                          )
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        statusText,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (_telemetry.isActive)
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        'Working: ${_formatDuration(_telemetry.workingTime)}',
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Timers Grid
            const Text(
              'TELEMETRY METRICS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Color(0xFF6B7280),
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 1.4,
              children: [
                _buildTimerCard(
                  title: 'Working Time',
                  value: _formatDurationWithTarget(_telemetry.workingTime, '8:00'),
                  icon: Icons.timer,
                  iconColor: const Color(0xFF6366F1),
                ),
                _buildTimerCard(
                  title: 'Calling (Talk)',
                  value: _formatDurationWithTarget(_telemetry.talkTime, '4:00'),
                  icon: Icons.phone_in_talk,
                  iconColor: const Color(0xFF10B981),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildMergedBreakIdleCard(
              breakVal: _formatDurationWithTarget(_telemetry.breakTime, '2:00'),
              idleVal: _formatDuration(_telemetry.idleTime),
            ),
            const SizedBox(height: 28),

            // Call Outcomes Card
            const Text(
              'CALL OUTCOMES TODAY',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Color(0xFF6B7280),
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF12131A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF222435)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildCallCounter(
                    label: 'Total Dialed',
                    count: _telemetry.connectedCalls + _telemetry.missedCalls,
                    color: const Color(0xFF6366F1),
                  ),
                  Container(width: 1, height: 40, color: const Color(0xFF222435)),
                  _buildCallCounter(
                    label: 'Connected',
                    count: _telemetry.connectedCalls,
                    color: const Color(0xFF10B981),
                  ),
                  Container(width: 1, height: 40, color: const Color(0xFF222435)),
                  _buildCallCounter(
                    label: 'Missed',
                    count: _telemetry.missedCalls,
                    color: const Color(0xFFEF4444),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 48),

            // Core Action Button
            ElevatedButton(
              onPressed: _handleSessionToggle,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                backgroundColor: const Color(0xFF6366F1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 8,
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
    );
  }

  Widget _buildTimerCard({
    required String title,
    required String value,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF12131A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF222435)),
      ),
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
                    style: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Icon(icon, color: iconColor, size: 20),
            ],
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCallCounter({
    required String label,
    required int count,
    required Color color,
  }) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        Text(
          count.toString(),
          style: TextStyle(color: color, fontSize: 32, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}
