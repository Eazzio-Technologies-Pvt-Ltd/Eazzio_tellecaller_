import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phone_state/phone_state.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/call_service.dart';
import 'package:eazzio_telecaller/services/recording_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/services/layout_service.dart';
import 'package:url_launcher/url_launcher.dart';

class CallingScreen extends StatefulWidget {
  const CallingScreen({super.key});

  @override
  State<CallingScreen> createState() => _CallingScreenState();
}

class _CallingScreenState extends State<CallingScreen> {
  final TelemetryService _telemetry = TelemetryService();
  final CallService _callService = CallService();
  final RecordingService _recorder = RecordingService();

  List<dynamic> _contacts = [];
  int _currentIndex = 0;
  bool _isLoading = true;
  String? _error;

  // Active Call Statuses
  bool _isDialing = false;
  bool _isCallActive = false;
  bool _wasConnected = false;
  int _callDurationSeconds = 0;
  Timer? _callDurationTimer;

  // Post-Call Post-Workspace States
  bool _showPostCallScreen = false;
  String _detectedCallStatus = 'non-connected';
  final TextEditingController _feedbackController = TextEditingController();
  DateTime? _followUpDate;
  
  // 30s post-call timer states
  int _countdownSeconds = 30;
  Timer? _countdownTimer;
  bool _isOnBreak = false;

  // Stream Subscription
  StreamSubscription? _phoneStateSub;

  // Timestamp (epoch ms) when SIM dialing was initiated
  int _callStartTimestamp = 0;

  Timer? _breakUiTimer;
  Timer? _shiftCheckTimer;

  // Tab & User Details
  int _selectedTab = 0;
  Map<String, dynamic>? _profileUser;

  // WhatsApp Templates
  final List<String> _whatsappTemplates = [
    "Hello, this is Eazzio Telecaller. We tried calling you.",
    "Welcome to Eazzio! Let us know when you're free for a quick chat.",
    "Hi, please call back when you are free.",
    "Hello, here are the details you requested."
  ];
  String _selectedTemplate = "Hello, this is Eazzio Telecaller. We tried calling you.";

  // Response Text Controllers
  final TextEditingController _response1Controller = TextEditingController();
  final TextEditingController _response2Controller = TextEditingController();
  final TextEditingController _response3Controller = TextEditingController();

  List<dynamic> get _activeContacts {
    final myId = _profileUser?['id'];
    if (myId == null) return _contacts;
    
    if (_selectedTab == 0) {
      // My Lead: added by myself
      return _contacts.where((c) => c['added_by'] == myId).toList();
    } else {
      // My Workspace: allotted by company admin
      return _contacts.where((c) => c['added_by'] != myId).toList();
    }
  }

  @override
  void initState() {
    super.initState();
    _loadProfile().then((_) {
      _loadAllottedContacts();
    });
    _checkAndRequestPermissions();
    _shiftCheckTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        _checkShiftCompletion();
      }
    });
  }

  Future<void> _loadProfile() async {
    try {
      final resp = await ApiService.fetchMe();
      if (mounted && resp != null) {
        final userObj = resp['user'] ?? resp;
        setState(() {
          _profileUser = userObj is Map<String, dynamic> ? userObj : null;
        });
      }
    } catch (e) {
      print('Error fetching profile in calling screen: $e');
    }
  }

  Future<void> _checkAndRequestPermissions() async {
    final statusPhone = await Permission.phone.status;
    final statusMic = await Permission.microphone.status;
    final statusAlert = await Permission.systemAlertWindow.status;
    final statusContacts = await Permission.contacts.status;
    
    const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
    bool hasCallLogPerm = false;
    try {
      hasCallLogPerm = await channel.invokeMethod('checkCallLogPermission') ?? false;
    } catch (e) {
      print('Error checking native call log permission: $e');
    }

    if (statusPhone.isGranted && statusMic.isGranted && statusAlert.isGranted && statusContacts.isGranted && hasCallLogPerm) {
      _initializeCallListener();
    } else {
      final results = await [
        Permission.phone,
        Permission.microphone,
        Permission.systemAlertWindow,
        Permission.contacts,
      ].request();

      if (!hasCallLogPerm) {
        try {
          await channel.invokeMethod('requestCallLogPermission');
          // Wait briefly for dialog interactions and recheck status
          await Future.delayed(const Duration(milliseconds: 500));
          hasCallLogPerm = await channel.invokeMethod('checkCallLogPermission') ?? false;
        } catch (e) {
          print('Error requesting native call log permission: $e');
        }
      }

      if (results[Permission.phone]?.isGranted == true &&
          results[Permission.microphone]?.isGranted == true &&
          results[Permission.systemAlertWindow]?.isGranted == true &&
          results[Permission.contacts]?.isGranted == true &&
          hasCallLogPerm) {
        _initializeCallListener();
      } else {
        setState(() {
          _error = "Phone State, Microphone, Contacts, Draw Over Other Apps, and Call Log permissions are required to use the Dialer Workspace. Please enable them in app settings.";
        });
      }
    }
  }

  void _initializeCallListener() {
    _callService.startListening();

    // Listen to physical call state updates
    _phoneStateSub?.cancel();
    _phoneStateSub = _callService.callStateStream.listen((status) {
      if (status == PhoneStateStatus.CALL_STARTED) {
        _handleCallConnected();
      } else if (status == PhoneStateStatus.CALL_ENDED || status == PhoneStateStatus.NOTHING) {
        _handleCallDisconnected();
      }
    });
  }

  @override
  void dispose() {
    _phoneStateSub?.cancel();
    _callDurationTimer?.cancel();
    _countdownTimer?.cancel();
    _breakUiTimer?.cancel();
    _shiftCheckTimer?.cancel();
    _feedbackController.dispose();
    _response1Controller.dispose();
    _response2Controller.dispose();
    _response3Controller.dispose();
    super.dispose();
  }

  void _checkShiftCompletion() {
    final workLimitSeconds = _telemetry.workTimeLimitHours * 3600;
    if (_telemetry.workingTime >= workLimitSeconds && !_telemetry.shiftCompleteShown) {
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
              ApiService.logout();
              if (mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                  (route) => false,
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

  int _calculateCurrentAttempt(dynamic contact) {
    if (contact == null) return 1;
    final lastTryDateStr = contact['last_try_date']?.toString();
    final todayStr = DateTime.now().toLocal().toString().split(' ')[0]; // YYYY-MM-DD
    
    if (lastTryDateStr != null && lastTryDateStr.startsWith(todayStr)) {
      final dbTryCount = contact['try_count'] ?? 0;
      if (dbTryCount >= 3) return 3;
      return dbTryCount + 1;
    }
    return 1;
  }

  void _prepareControllersForCurrentContact() {
    if (_activeContacts.isEmpty || _currentIndex >= _activeContacts.length) return;
    final contact = _activeContacts[_currentIndex];
    final currentTry = _calculateCurrentAttempt(contact);
    
    // Check if it's a new day to reset response inputs
    final lastTryDateStr = contact['last_try_date']?.toString();
    final todayStr = DateTime.now().toLocal().toString().split(' ')[0];
    final isNewDay = lastTryDateStr == null || !lastTryDateStr.startsWith(todayStr);

    if (isNewDay) {
      _response1Controller.text = '';
      _response2Controller.text = '';
      _response3Controller.text = '';
    } else {
      _response1Controller.text = (currentTry > 1) ? (contact['response_1']?.toString() ?? '') : '';
      _response2Controller.text = (currentTry > 2) ? (contact['response_2']?.toString() ?? '') : '';
      _response3Controller.text = (currentTry > 3) ? (contact['response_3']?.toString() ?? '') : '';
    }
  }

  Future<void> _loadAllottedContacts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final contacts = await ApiService.fetchAllottedContacts();
    
    setState(() {
      _contacts = contacts;
      _isLoading = false;
      if (contacts.isEmpty) {
        _error = "No allotted leads for today. Ask your administrator to assign contacts.";
      } else {
        _prepareControllersForCurrentContact();
      }
    });
  }

  void _dialCurrentContact() {
    if (_activeContacts.isEmpty || _currentIndex >= _activeContacts.length) return;
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final textColor = isDark ? Colors.white : const Color(0xFF111827);
        final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;

        return AlertDialog(
          backgroundColor: cardColor,
          title: Text('Call Lead', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
          content: Text('Would you like to dial this SIM number or skip this call?', style: TextStyle(color: textColor)),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _skipCurrentCall();
              },
              child: const Text('Skip the call', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _executeDialCurrentContact();
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
              child: const Text('Dial', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _skipCurrentCall() {
    setState(() {
      _showPostCallScreen = true;
      _isDialing = false;
      _isCallActive = false;
      _detectedCallStatus = 'missed';
      _callDurationSeconds = 0; // Ensure skipped call duration is exactly 0
      _feedbackController.text = 'Skipped call';
      _response1Controller.text = 'Skipped call';
      _response2Controller.text = 'Skipped call';
      _response3Controller.text = 'Skipped call';
    });
  }

  void _showProxyCallWarning() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF12131A),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
            SizedBox(width: 8),
            Text('Proxy Call Alert', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'Warning: Your active call duration has exceeded the company threshold limit of ${_profileUser?["proxyLimitMinutes"] ?? 10} minutes. Please wrap up the call.',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Dismiss', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // Execute Dial Current Contact
  void _executeDialCurrentContact() async {
    if (_activeContacts.isEmpty || _currentIndex >= _activeContacts.length) return;
    
    final contact = _activeContacts[_currentIndex];
    final String phoneNumber = contact['phone_number'];

    setState(() {
      _isDialing = true;
      _wasConnected = false;
      _showPostCallScreen = false;
      _callDurationSeconds = 0;
      _followUpDate = null;
      _feedbackController.clear();
      _response1Controller.clear();
      _response2Controller.clear();
      _response3Controller.clear();
      _detectedCallStatus = 'non-connected';
    });

    // Record dial timestamp so _detectCallOutcome only matches this new call
    _callStartTimestamp = DateTime.now().millisecondsSinceEpoch;

    // Launch Dialer Intent
    final launched = await _callService.dialNumber(phoneNumber);
    if (!launched) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to open dialer. Check permissions.')),
      );
      setState(() {
        _isDialing = false;
      });
    }
  }

  // Call Event: Started / Dial Connected
  void _handleCallConnected() {
    if (_isCallActive) return;

    setState(() {
      _isDialing = false;
      _isCallActive = true;
      _wasConnected = true;
    });

    // Request state updates only when call connects
    _telemetry.setCallingState(true);

    // Start Recording Mic audio
    _recorder.startRecording();

    // Start timer for duration UI
    _callDurationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _callDurationSeconds++;
        });
        final limitMins = _profileUser?['proxyLimitMinutes'] ?? 10;
        if (_callDurationSeconds == limitMins * 60) {
          _showProxyCallWarning();
        }
      }
    });
  }

  /// Returns true if two phone number strings refer to the same subscriber
  /// by comparing their last 10 digits (ignoring country codes and formatting).
  bool _phoneNumbersMatch(String a, String b) {
    final digitsA = a.replaceAll(RegExp(r'\D'), '');
    final digitsB = b.replaceAll(RegExp(r'\D'), '');
    if (digitsA.isEmpty || digitsB.isEmpty) return false;
    final last10A = digitsA.length > 10 ? digitsA.substring(digitsA.length - 10) : digitsA;
    final last10B = digitsB.length > 10 ? digitsB.substring(digitsB.length - 10) : digitsB;
    return last10A == last10B;
  }

  Future<void> _detectCallOutcome() async {
    try {
      final contact = _activeContacts[_currentIndex < _activeContacts.length ? _currentIndex : 0];
      final String contactPhone = contact['phone_number'].toString();
      
      const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
      
      // Try up to 8 times (total ~8 seconds) to retrieve the call log matching this dial session
      for (int attempt = 1; attempt <= 8; attempt++) {
        await Future.delayed(Duration(milliseconds: attempt == 1 ? 1500 : 1000));
        
        final dynamic recentLogs = await channel.invokeMethod('getRecentCallLogs', {'limit': 20});
        
        if (recentLogs != null && recentLogs is List) {
          for (var log in recentLogs) {
            if (log is Map) {
              final String number = log['number'] ?? '';
              final int duration = log['duration'] ?? 0;
              final int type = log['type'] ?? 0;
              final int date = log['date'] ?? 0; // Epoch timestamp in milliseconds
              
              // Only consider call logs that started at or after dialing began (10s grace period)
              if (date < _callStartTimestamp - 10000) continue;
              
              // Match phone numbers by comparing last 10 digits to handle country code variations
              if (_phoneNumbersMatch(number, contactPhone)) {
                setState(() {
                  if (duration > 0) {
                    _callDurationSeconds = duration; // Sync exact duration from Android call log
                  }
                  if (type == 2) {
                    // Outgoing
                    _detectedCallStatus = (duration > 0 || _wasConnected) ? 'connected' : 'non-connected';
                  } else if (type == 1) {
                    // Incoming
                    _detectedCallStatus = (duration > 0 || _wasConnected) ? 'received' : 'missed';
                  } else if (type == 3 || type == 5) {
                    // Missed or Rejected
                    _detectedCallStatus = 'missed';
                  } else {
                    _detectedCallStatus = (duration > 0 || _wasConnected) ? 'connected' : 'non-connected';
                  }
                });
                print('[CallLog] Match found on attempt $attempt! Outcome: $_detectedCallStatus, Duration: $_callDurationSeconds');
                return; // Exit on successful match
              }
            }
          }
        }
      }
      
      // If we reach here, no matching log entry was found
      setState(() {
        if (_wasConnected || _callDurationSeconds > 0) {
          _detectedCallStatus = 'connected';
        } else {
          _detectedCallStatus = 'non-connected';
          _callDurationSeconds = 0;
        }
      });
      print('[CallLog] No matching recent call log found. Defaulting to $_detectedCallStatus.');
    } catch (e) {
      print('[CallLog] Error retrieving recent call logs: $e');
      setState(() {
        _detectedCallStatus = 'non-connected';
        _callDurationSeconds = 0;
      });
    }
  }

  // Call Event: Hung Up / Terminated
  void _handleCallDisconnected() async {
    if (!_isCallActive && !_isDialing) return;

    _callDurationTimer?.cancel();
    _telemetry.setCallingState(false);

    // Stop mic recording and grab filepath
    final String? recPath = await _recorder.stopRecording();

    // Bring app back to foreground
    try {
      const MethodChannel('com.eazzio.eazzio_telecaller/app_control')
          .invokeMethod('bringToForeground');
    } catch (e) {
      print('Failed to bring app to foreground: $e');
    }

    // Auto-detect call outcome from call logs
    await _detectCallOutcome();

    setState(() {
      _isCallActive = false;
      _isDialing = false;
      _showPostCallScreen = true;
      _countdownSeconds = 30;
    });

    // Start the 30 second auto dial countdown
    _startCountdown(recPath);
  }

  void _startCountdown(String? recordingPath) {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_isOnBreak) return; // Freeze countdown if taking a break

      setState(() {
        if (_countdownSeconds > 0) {
          _countdownSeconds--;
        } else {
          _countdownTimer?.cancel();
          _submitAndGoToNext(recordingPath);
        }
      });
    });
  }

  // Toggle pause/break on the countdown timer
  void _toggleBreakState() {
    setState(() {
      _isOnBreak = !_isOnBreak;
      _telemetry.setBreakState(_isOnBreak);
      
      if (_isOnBreak) {
        _breakUiTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (mounted) setState(() {});
        });
      } else {
        _breakUiTimer?.cancel();
        _breakUiTimer = null;
      }
    });
  }

  // Submit Feedback & Proceed to Next Lead
  Future<void> _submitAndGoToNext([String? recordingPath]) async {
    _countdownTimer?.cancel();

    if (_activeContacts.isEmpty || _currentIndex >= _activeContacts.length) return;
    
    final contact = _activeContacts[_currentIndex];
    final String callStatus = _detectedCallStatus;
    // Enforce 0 duration for missed/non-connected calls per rule
    final int duration = (callStatus == 'missed' || callStatus == 'non-connected') ? 0 : _callDurationSeconds;
    final int currentTry = _calculateCurrentAttempt(contact);
    // Use the response field of the active try as feedback
    final String feedback = currentTry == 3
        ? _response3Controller.text.trim()
        : currentTry == 2
            ? _response2Controller.text.trim()
            : _response1Controller.text.trim().isNotEmpty
                ? _response1Controller.text.trim()
                : _feedbackController.text.trim();
    final String? followUp = _followUpDate != null 
        ? _followUpDate!.toIso8601String() 
        : null;

    // Track counters in stats
    if (callStatus == 'connected') {
      _telemetry.connectedCalls++;
      _telemetry.connectedDuration += duration;
    } else if (callStatus == 'non-connected') {
      _telemetry.nonConnectedCalls++;
      _telemetry.nonConnectedDuration += duration;
    } else if (callStatus == 'received') {
      _telemetry.receivedCalls++;
      _telemetry.receivedDuration += duration;
    } else if (callStatus == 'missed') {
      _telemetry.missedCalls++;
      _telemetry.missedDuration += duration;
    }

    // Submit log payload asynchronously to avoid UI lagging
    ApiService.submitCallLog(
      contactId: contact['id'],
      callStatus: callStatus,
      duration: duration,
      feedback: feedback,
      followUpDate: followUp,
      recordingPath: recordingPath,
    );

    // Move to next contact or complete daily flow
    setState(() {
      _currentIndex++;
      _showPostCallScreen = false;
      _isOnBreak = false;
      _followUpDate = null;
      _feedbackController.clear();
      _response1Controller.clear();
      _response2Controller.clear();
      _response3Controller.clear();
    });

    if (_currentIndex < _activeContacts.length) {
      _prepareControllersForCurrentContact();
      // Auto dial next lead
      _dialCurrentContact();
    } else {
      _showCompletionDialog();
    }
  }

  void _showCompletionDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        title: Text('All Leads Completed', style: TextStyle(color: textColor)),
        content: Text(
          'Excellent! You have dialed all allotted leads for today.',
          style: TextStyle(color: subtextColor),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // close modal
              Navigator.pop(context); // return to dashboard
            },
            child: const Text('Back to Dashboard', style: TextStyle(color: Color(0xFF6366F1))),
          ),
        ],
      ),
    );
  }

  Future<void> _selectFollowUpDate() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: isDark
                ? const ColorScheme.dark(
                    primary: Color(0xFF6366F1),
                    onPrimary: Colors.white,
                    surface: Color(0xFF12131A),
                    onSurface: Colors.white,
                  )
                : const ColorScheme.light(
                    primary: Color(0xFF6366F1),
                    onPrimary: Colors.white,
                    surface: Colors.white,
                    onSurface: Color(0xFF111827),
                  ),
            dialogBackgroundColor: isDark ? const Color(0xFF0A0B10) : Colors.white,
          ),
          child: child!,
        );
      },
    );

    if (pickedDate != null) {
      setState(() {
        _followUpDate = pickedDate;
      });
    }
  }

  String _formatCallDuration(int seconds) {
    final int m = seconds ~/ 60;
    final int s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_isOnBreak && _telemetry.currentState != TelemetryState.onBreak) {
      _isOnBreak = false;
      _breakUiTimer?.cancel();
      _breakUiTimer = null;
    }

    if (_isLoading) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
      return Scaffold(
        backgroundColor: bgColor,
        body: const Center(
          child: CircularProgressIndicator(color: Color(0xFF6366F1)),
        ),
      );
    }

    if (_error != null) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
      final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
      final textColor = isDark ? Colors.white : const Color(0xFF111827);

      return Scaffold(
        backgroundColor: bgColor,
        appBar: AppBar(
          backgroundColor: cardColor,
          title: Text('Dialer Workspace', style: TextStyle(color: textColor)),
        ),
        body: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.info_outline, color: Color(0xFFF59E0B), size: 64),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: textColor, fontSize: 16),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
                child: const Text('Back to Dashboard', style: TextStyle(color: Colors.white)),
              )
            ],
          ),
        ),
      );
    }

    if (_isOnBreak) {
      return _buildBreakScreen();
    }

    if (_activeContacts.isEmpty) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
      final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
      final textColor = isDark ? Colors.white : const Color(0xFF111827);
      final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);

      return Scaffold(
        backgroundColor: bgColor,
        appBar: AppBar(
          backgroundColor: cardColor,
          title: Text('Dialer Workspace', style: TextStyle(color: textColor)),
        ),
        body: Column(
          children: [
            _buildWorkspaceTabs(isDark),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.phone_disabled_rounded, color: subtextColor, size: 64),
                      const SizedBox(height: 16),
                      Text(
                        _selectedTab == 0
                            ? 'No leads added by you yet.'
                            : 'No leads allotted by admin yet.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: textColor, fontSize: 16),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _selectedTab == 0
                            ? 'Add leads first from the dashboard.'
                            : 'Ask your administrator to allot contacts.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: subtextColor, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final contact = _activeContacts[_currentIndex < _activeContacts.length ? _currentIndex : 0];
    final totalLeads = _activeContacts.length;
    final safeIndex = _currentIndex < totalLeads ? _currentIndex : totalLeads - 1;
    final progress = (safeIndex + 1) / totalLeads;

    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: cardColor,
        title: Text(
          'Lead ${safeIndex + 1} of $totalLeads',
          style: TextStyle(color: textColor, fontSize: layout.fontSizeHeading, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          _buildWorkspaceTabs(isDark),
          Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(layout.scale(14.0, 20.0)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Progress Bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: layout.scale(4.0, 6.0),
                        backgroundColor: isDark ? const Color(0xFF1E1F29) : const Color(0xFFE5E7EB),
                        valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                      ),
                    ),
                    SizedBox(height: layout.spacing),

                    if (!_showPostCallScreen) ...[
                      // Main Contact Call Panel
                      _buildContactPanel(contact),
                    ] else ...[
                      // Post-Call Feedback Panel
                      _buildPostCallPanel(),
                    ],

                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkspaceTabs(bool isDark) {
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF);
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);

    return Container(
      color: cardColor,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (_selectedTab != 0) {
                      setState(() {
                        _selectedTab = 0;
                        _currentIndex = 0;
                        _showPostCallScreen = false;
                      });
                      _prepareControllersForCurrentContact();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: _selectedTab == 0 ? const Color(0xFF6366F1) : Colors.transparent,
                          width: 2.5,
                        ),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_pin_rounded,
                          color: _selectedTab == 0 ? const Color(0xFF6366F1) : mutedColor,
                          size: 18,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'My Lead',
                          style: TextStyle(
                            color: _selectedTab == 0 ? const Color(0xFF6366F1) : mutedColor,
                            fontWeight: _selectedTab == 0 ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Container(width: 1, height: 40, color: borderColor),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (_selectedTab != 1) {
                      setState(() {
                        _selectedTab = 1;
                        _currentIndex = 0;
                        _showPostCallScreen = false;
                      });
                      _prepareControllersForCurrentContact();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: _selectedTab == 1 ? const Color(0xFF10B981) : Colors.transparent,
                          width: 2.5,
                        ),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.business_center_rounded,
                          color: _selectedTab == 1 ? const Color(0xFF10B981) : mutedColor,
                          size: 18,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'My Workspace',
                          style: TextStyle(
                            color: _selectedTab == 1 ? const Color(0xFF10B981) : mutedColor,
                            fontWeight: _selectedTab == 1 ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          Divider(height: 1, color: borderColor),
        ],
      ),
    );
  }

  Widget _buildContactPanel(dynamic contact) {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final circleBg = isDark ? const Color(0xFF1E2030) : const Color(0xFFF3F4F6);

    final accentColor = const Color(0xFF6366F1); // Indigo

    return Container(
      padding: EdgeInsets.all(layout.scale(16.0, 24.0)),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(layout.cardRadius),
        border: Border.all(color: isDark ? borderColor : accentColor.withOpacity(0.3), width: isDark ? 1 : 2),
        boxShadow: [
          BoxShadow(
            color: accentColor.withOpacity(isDark ? 0.03 : 0.05),
            blurRadius: isDark ? 4 : 6,
            offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: layout.scale(30.0, 36.0),
            backgroundColor: circleBg,
            child: Icon(Icons.person, size: layout.scale(30.0, 36.0), color: subtextColor),
          ),
          SizedBox(height: layout.scale(12.0, 16.0)),
          Text(
            contact['name'],
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: layout.fontSizeTitle, fontWeight: FontWeight.bold, color: textColor),
          ),
          const SizedBox(height: 8),
          Text(
            contact['phone_number'],
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: layout.fontSizeHeading, letterSpacing: 0.5, color: subtextColor),
          ),
          const SizedBox(height: 12),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: layout.scale(10.0, 12.0),
              vertical: layout.scale(4.0, 6.0),
            ),
            decoration: BoxDecoration(
              color: const Color(0x1F6366F1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'Campaign: ${contact['campaign_name']}',
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: layout.fontSizeCaption,
                color: const Color(0xFF818CF8),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          SizedBox(height: layout.scale(24.0, 40.0)),

          // Calling controls
          if (_isDialing) ...[
            const CircularProgressIndicator(color: Color(0xFF6366F1)),
            const SizedBox(height: 12),
            Text('Dialing contact on SIM Network...', style: TextStyle(color: subtextColor)),
          ] else if (_isCallActive) ...[
            Column(
              children: [
                Container(
                  padding: EdgeInsets.all(layout.scale(8.0, 12.0)),
                  decoration: const BoxDecoration(
                    color: Color(0x1F10B981),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.call_made, color: const Color(0xFF10B981), size: layout.scale(22.0, 28.0)),
                ),
                const SizedBox(height: 12),
                Text(
                  _formatCallDuration(_callDurationSeconds),
                  style: TextStyle(fontSize: layout.fontSizeLargeCount, fontWeight: FontWeight.bold, color: textColor),
                ),
                const SizedBox(height: 8),
                const Text('Active Call Recording...', style: TextStyle(color: Color(0xFF10B981))),
              ],
            ),
          ] else ...[
            // Try count chip
            () {
              final currentTry = _calculateCurrentAttempt(contact);
              final tryColor = currentTry == 1
                  ? const Color(0xFF6366F1)
                  : currentTry == 2
                      ? const Color(0xFFF59E0B)
                      : const Color(0xFFEF4444);
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: tryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: tryColor.withOpacity(0.5)),
                ),
                child: Text(
                  'Try $currentTry of 3 today',
                  style: TextStyle(color: tryColor, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              );
            }(),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _dialCurrentContact,
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(
                  horizontal: layout.scale(20.0, 32.0),
                  vertical: layout.scale(12.0, 16.0),
                ),
                backgroundColor: const Color(0xFF10B981),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(layout.cardRadius)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.phone, color: Colors.white),
                  const SizedBox(width: 8),
                  Text(
                    'Dial SIM Number',
                    style: TextStyle(
                      fontSize: layout.scale(14.0, 16.0),
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: _toggleBreakState,
              icon: const Icon(Icons.coffee, color: Color(0xFFA855F7)),
              label: Text(
                'Take a Break',
                style: TextStyle(
                  color: const Color(0xFFA855F7),
                  fontWeight: FontWeight.bold,
                  fontSize: layout.scale(13.0, 14.0),
                ),
              ),
            ),
          ]
        ],
      ),
    );
  }

  Widget _buildWhatsAppSender(dynamic contact, ResponsiveLayout layout, bool isDark, Color textColor) {
    if (contact == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF25D366).withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF25D366).withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.chat_bubble_rounded, color: Color(0xFF25D366), size: 16),
              SizedBox(width: 6),
              Text('WhatsApp Message', style: TextStyle(color: Color(0xFF25D366), fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 8),
          DropdownButton<String>(
            value: _selectedTemplate,
            isExpanded: true,
            dropdownColor: isDark ? const Color(0xFF12131A) : Colors.white,
            underline: const SizedBox.shrink(),
            style: TextStyle(color: textColor, fontSize: 12),
            items: _whatsappTemplates.map((t) => DropdownMenuItem(
              value: t,
              child: Text(t, overflow: TextOverflow.ellipsis, style: TextStyle(color: textColor, fontSize: 12)),
            )).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedTemplate = val);
            },
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () async {
                final rawPhone = contact['phone_number'].toString().replaceAll(RegExp(r'\D'), '');
                // Prepend India country code (91) if number has exactly 10 digits
                final phone = rawPhone.length == 10 ? '91$rawPhone' : rawPhone;
                final msg = Uri.encodeComponent(_selectedTemplate);
                // Try wa.me deep link first, bypass canLaunchUrl
                final waUri = Uri.parse('https://wa.me/$phone?text=$msg');
                bool launched = false;
                try {
                  launched = await launchUrl(waUri, mode: LaunchMode.externalApplication);
                } catch (_) {}
                if (!launched) {
                  // Fallback: direct whatsapp:// deep link
                  final fallbackUri = Uri.parse('whatsapp://send?phone=$phone&text=$msg');
                  try {
                    await launchUrl(fallbackUri, mode: LaunchMode.externalApplication);
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('WhatsApp is not installed on this device.')),
                      );
                    }
                  }
                }
                ApiService.incrementWhatsappCount();
              },
              icon: const Icon(Icons.send_rounded, size: 16, color: Colors.white),
              label: const Text('Send WhatsApp', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF25D366),
                padding: const EdgeInsets.symmetric(vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPostCallPanel() {
    final contact = _activeContacts.isEmpty ? null : _activeContacts[_currentIndex < _activeContacts.length ? _currentIndex : 0];
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final mutedColor = isDark ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF);
    final fieldFillColor = isDark ? const Color(0xFF1E2030) : const Color(0xFFF3F4F6);

    final accentColor = const Color(0xFF10B981); // Green

    return Container(
      padding: EdgeInsets.all(layout.scale(16.0, 24.0)),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(layout.cardRadius),
        border: Border.all(color: isDark ? borderColor : accentColor.withOpacity(0.3), width: isDark ? 1 : 2),
        boxShadow: [
          BoxShadow(
            color: accentColor.withOpacity(isDark ? 0.03 : 0.05),
            blurRadius: isDark ? 4 : 6,
            offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'CALL DISCONNECTED',
            textAlign: TextAlign.center,
            style: TextStyle(color: mutedColor, fontWeight: FontWeight.bold, fontSize: layout.fontSizeCaption),
          ),
          const SizedBox(height: 6),
          Text(
            'Duration: ${_formatCallDuration(_callDurationSeconds)}',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: layout.scale(18.0, 22.0), fontWeight: FontWeight.bold, color: textColor),
          ),
          
          SizedBox(height: layout.scale(8.0, 12.0)),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: layout.scale(12.0, 16.0),
              vertical: layout.scale(8.0, 10.0),
            ),
            decoration: BoxDecoration(
              color: _detectedCallStatus == 'connected' || _detectedCallStatus == 'received'
                  ? const Color(0x1F10B981)
                  : const Color(0x1FEF4444),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _detectedCallStatus == 'connected' || _detectedCallStatus == 'received'
                      ? Icons.check_circle
                      : Icons.cancel,
                  color: _detectedCallStatus == 'connected' || _detectedCallStatus == 'received'
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                  size: layout.scale(15.0, 18.0),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _detectedCallStatus == 'connected'
                        ? 'Detected Outgoing: Connected'
                        : _detectedCallStatus == 'non-connected'
                            ? 'Detected Outgoing: Unanswered'
                            : _detectedCallStatus == 'received'
                                ? 'Detected Incoming: Answered'
                                : 'Detected Incoming: Missed',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: layout.scale(11.0, 13.0),
                      color: _detectedCallStatus == 'connected' || _detectedCallStatus == 'received'
                          ? const Color(0xFF10B981)
                          : const Color(0xFFEF4444),
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: layout.scale(8.0, 12.0)),

          // Follow-up Picker
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Schedule Follow-Up?', style: TextStyle(color: textColor, fontSize: layout.scale(13.0, 14.0))),
            subtitle: Text(
              _followUpDate != null 
                  ? 'Selected: ${_followUpDate!.toLocal().toString().split(' ')[0]}' 
                  : 'Add lead to follow-up lists',
              style: TextStyle(color: subtextColor, fontSize: layout.scale(11.0, 12.0)),
            ),
            trailing: TextButton(
              onPressed: _selectFollowUpDate,
              child: Text(
                _followUpDate != null ? 'Change Date' : 'Set Date',
                style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold),
              ),
            ),
          ),
          SizedBox(height: layout.scale(8.0, 12.0)),

          // Response fields by try
          Builder(builder: (context) {
            final contact = _activeContacts.isEmpty ? null : _activeContacts[_currentIndex < _activeContacts.length ? _currentIndex : 0];
            final currentTry = _calculateCurrentAttempt(contact);
            
            Widget _buildResponseField(String label, TextEditingController ctrl, bool isReadOnly, bool isActive) {
              final Color fieldColor = isReadOnly
                  ? (isDark ? const Color(0xFF1A1C22) : const Color(0xFFEFEFEF))
                  : (isDark ? const Color(0xFF1E2030) : const Color(0xFFF3F4F6));
              final borderColor = isActive
                  ? const Color(0xFF6366F1).withOpacity(0.5)
                  : Colors.transparent;
              
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        isReadOnly ? Icons.lock_rounded : Icons.edit_rounded,
                        color: isReadOnly ? mutedColor : const Color(0xFF6366F1),
                        size: 12,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        label,
                        style: TextStyle(
                          color: isReadOnly ? mutedColor : subtextColor,
                          fontSize: layout.fontSizeCaption,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: ctrl,
                    readOnly: isReadOnly,
                    style: TextStyle(color: isReadOnly ? mutedColor : textColor, fontSize: 13),
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: isReadOnly ? 'No response recorded' : 'Enter call notes / feedback...',
                      hintStyle: TextStyle(color: mutedColor, fontSize: 12),
                      filled: true,
                      fillColor: fieldColor,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(color: borderColor, width: 1.5),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(color: isActive ? const Color(0xFF6366F1) : Colors.transparent, width: 1.5),
                      ),
                    ),
                  ),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildResponseField(
                  'RESPONSE 1',
                  _response1Controller,
                  currentTry > 1 || _response1Controller.text.isNotEmpty && currentTry != 1,
                  currentTry == 1,
                ),
                const SizedBox(height: 10),
                _buildResponseField(
                  'RESPONSE 2',
                  _response2Controller,
                  currentTry < 2 || (currentTry > 2 && _response2Controller.text.isNotEmpty),
                  currentTry == 2,
                ),
                const SizedBox(height: 10),
                _buildResponseField(
                  'RESPONSE 3',
                  _response3Controller,
                  currentTry < 3,
                  currentTry == 3,
                ),
              ],
            );
          }),
          SizedBox(height: layout.spacing),

          // WhatsApp Template Sender in Post-Call Feedback
          _buildWhatsAppSender(contact, layout, isDark, textColor),
          SizedBox(height: layout.spacing),

          // Countdown Timer Section
          Container(
            padding: EdgeInsets.all(layout.scale(12.0, 16.0)),
            decoration: BoxDecoration(
              color: fieldFillColor,
              borderRadius: BorderRadius.circular(layout.scale(10.0, 12.0)),
            ),
            child: Column(
              children: [
                Text(
                  _isOnBreak 
                      ? 'Auto-Dialing Paused (On Break)' 
                      : 'Next auto-dialing initiates in $_countdownSeconds seconds...',
                  style: TextStyle(color: textColor, fontSize: layout.fontSizeBody - 1, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _toggleBreakState,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isOnBreak ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                          padding: EdgeInsets.symmetric(vertical: layout.scale(8.0, 10.0)),
                        ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            _isOnBreak ? 'Resume Auto-Dial' : 'Take a Break',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: layout.scale(8.0, 12.0)),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => _submitAndGoToNext(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          padding: EdgeInsets.symmetric(vertical: layout.scale(8.0, 10.0)),
                        ),
                        child: const FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            'Submit & Dial Next',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ),
                  ],
                )
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreakScreen() {
    final layout = ResponsiveLayout(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0B10) : Colors.grey[200];
    final cardColor = isDark ? const Color(0xFF12131A) : Colors.white;
    final borderColor = isDark ? const Color(0xFF222435) : const Color(0xFFE5E7EB);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    final breakAccentColor = const Color(0xFFA855F7); // Purple

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: layout.scale(20.0, 32.0),
              vertical: layout.scale(16.0, 24.0),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    padding: EdgeInsets.all(layout.scale(18.0, 28.0)),
                    decoration: BoxDecoration(
                      color: const Color(0x1FA855F7),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0x33A855F7), width: 2),
                    ),
                    child: Icon(
                      Icons.coffee,
                      color: const Color(0xFFA855F7),
                      size: layout.scale(48.0, 64.0),
                    ),
                  ),
                ),
                SizedBox(height: layout.scale(20.0, 32.0)),
                Text(
                  'YOU ARE ON A BREAK',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: layout.scale(18.0, 24.0),
                    fontWeight: FontWeight.bold,
                    color: textColor,
                    letterSpacing: 1.5,
                  ),
                ),
                SizedBox(height: layout.scale(8.0, 12.0)),
                Text(
                  'Auto-dialing and call tracking are temporarily paused. Take your time to relax and recharge.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: layout.fontSizeBody,
                    color: subtextColor,
                    height: 1.5,
                  ),
                ),
                SizedBox(height: layout.scale(24.0, 48.0)),
                Container(
                  padding: EdgeInsets.symmetric(
                    vertical: layout.scale(16.0, 24.0),
                    horizontal: layout.scale(12.0, 16.0),
                  ),
                  decoration: BoxDecoration(
                    color: cardColor,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isDark ? borderColor : breakAccentColor.withOpacity(0.3), width: isDark ? 1 : 2),
                    boxShadow: [
                      BoxShadow(
                        color: breakAccentColor.withOpacity(isDark ? 0.03 : 0.05),
                        blurRadius: isDark ? 4 : 6,
                        offset: isDark ? const Offset(0, 2) : const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Text(
                        'BREAK ELAPSED TIME',
                        style: TextStyle(
                          color: subtextColor,
                          fontSize: layout.fontSizeCaption,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                      ),
                      SizedBox(height: layout.scale(8.0, 12.0)),
                      Text(
                        _formatCallDuration(_telemetry.breakTime),
                        style: TextStyle(
                          fontSize: layout.scale(36.0, 48.0),
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFA855F7),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: layout.scale(24.0, 48.0)),
                ElevatedButton(
                  onPressed: _toggleBreakState,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: layout.scale(12.0, 18.0)),
                    backgroundColor: const Color(0xFF6366F1),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 6,
                    shadowColor: const Color(0x4D6366F1),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_arrow, color: Colors.white, size: layout.scale(20.0, 24.0)),
                      const SizedBox(width: 8),
                      Text(
                        'Resume Dialer Workspace',
                        style: TextStyle(
                          fontSize: layout.fontSizeHeading,
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
      ),
    );
  }
}
