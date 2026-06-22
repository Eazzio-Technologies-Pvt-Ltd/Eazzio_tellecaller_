import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phone_state/phone_state.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:eazzio_telecaller/services/api_service.dart';
import 'package:eazzio_telecaller/services/call_service.dart';
import 'package:eazzio_telecaller/services/recording_service.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';

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
  int _callDurationSeconds = 0;
  Timer? _callDurationTimer;

  // Post-Call Post-Workspace States
  bool _showPostCallScreen = false;
  bool _isCallOutcomeConnected = true;
  final TextEditingController _feedbackController = TextEditingController();
  DateTime? _followUpDate;
  
  // 30s post-call timer states
  int _countdownSeconds = 30;
  Timer? _countdownTimer;
  bool _isOnBreak = false;

  // Stream Subscription
  StreamSubscription? _phoneStateSub;

  Timer? _breakUiTimer;

  @override
  void initState() {
    super.initState();
    _loadAllottedContacts();
    _checkAndRequestPermissions();
  }

  Future<void> _checkAndRequestPermissions() async {
    final statusPhone = await Permission.phone.status;
    final statusMic = await Permission.microphone.status;
    final statusAlert = await Permission.systemAlertWindow.status;
    
    const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
    bool hasCallLogPerm = false;
    try {
      hasCallLogPerm = await channel.invokeMethod('checkCallLogPermission') ?? false;
    } catch (e) {
      print('Error checking native call log permission: $e');
    }

    if (statusPhone.isGranted && statusMic.isGranted && statusAlert.isGranted && hasCallLogPerm) {
      _initializeCallListener();
    } else {
      final results = await [
        Permission.phone,
        Permission.microphone,
        Permission.systemAlertWindow,
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
          hasCallLogPerm) {
        _initializeCallListener();
      } else {
        setState(() {
          _error = "Phone State, Microphone, Draw Over Other Apps, and Call Log permissions are required to use the Dialer Workspace. Please enable them in app settings.";
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
    _feedbackController.dispose();
    super.dispose();
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
      }
    });
  }

  // Dial Current Contact
  void _dialCurrentContact() async {
    if (_contacts.isEmpty || _currentIndex >= _contacts.length) return;
    
    final contact = _contacts[_currentIndex];
    final String phoneNumber = contact['phone_number'];

    setState(() {
      _isDialing = true;
      _showPostCallScreen = false;
      _callDurationSeconds = 0;
      _followUpDate = null;
      _feedbackController.clear();
    });

    // Request state updates
    _telemetry.setCallingState(true);

    // Launch Dialer Intent
    final launched = await _callService.dialNumber(phoneNumber);
    if (!launched) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to open dialer. Check permissions.')),
      );
      setState(() {
        _isDialing = false;
      });
      _telemetry.setCallingState(false);
    }
  }

  // Call Event: Started / Dial Connected
  void _handleCallConnected() {
    if (_isCallActive) return;

    setState(() {
      _isDialing = false;
      _isCallActive = true;
    });

    // Start Recording Mic audio
    _recorder.startRecording();

    // Start timer for duration UI
    _callDurationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _callDurationSeconds++;
      });
    });
  }

  Future<void> _detectCallOutcome() async {
    try {
      // Wait 1.5 seconds for Android OS to write the call log entry
      await Future.delayed(const Duration(milliseconds: 1500));
      
      const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
      final dynamic callDetails = await channel.invokeMethod('getLastCallDetails');
      
      if (callDetails != null && callDetails is Map) {
        final String number = callDetails['number'] ?? '';
        final int duration = callDetails['duration'] ?? 0;
        
        print('[CallLog] Detected last call details: number=$number, duration=$duration');
        
        // Compare number with the current contact's number
        final contact = _contacts[_currentIndex];
        final String contactPhone = contact['phone_number'].toString().replaceAll(RegExp(r'\D'), '');
        final String cleanLogNumber = number.replaceAll(RegExp(r'\D'), '');
        
        // Check if it matches the last digits to handle varying formats / country codes
        if (cleanLogNumber.endsWith(contactPhone) || contactPhone.endsWith(cleanLogNumber)) {
          setState(() {
            if (duration > 0) {
              _isCallOutcomeConnected = true;
              _callDurationSeconds = duration; // Sync exact duration from Android call log
            } else {
              _isCallOutcomeConnected = false;
              _callDurationSeconds = 0;
            }
          });
          print('[CallLog] Match found! Outcome connected: $_isCallOutcomeConnected, Duration: $_callDurationSeconds');
        } else {
          print('[CallLog] Last call log number ($cleanLogNumber) did not match contact number ($contactPhone).');
        }
      } else {
        print('[CallLog] No call log details returned.');
      }
    } catch (e) {
      print('[CallLog] Error retrieving last call log: $e');
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

    if (_contacts.isEmpty || _currentIndex >= _contacts.length) return;
    
    final contact = _contacts[_currentIndex];
    final bool outcomeConnected = _isCallOutcomeConnected;
    final int duration = _callDurationSeconds;
    final String feedback = _feedbackController.text.trim();
    final String? followUp = _followUpDate != null 
        ? _followUpDate!.toIso8601String() 
        : null;

    // Track counters in stats
    if (outcomeConnected) {
      _telemetry.connectedCalls++;
    } else {
      _telemetry.missedCalls++;
    }

    // Submit log payload asynchronously to avoid UI lagging
    ApiService.submitCallLog(
      contactId: contact['id'],
      callStatus: outcomeConnected ? 'connected' : 'missed',
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
    });

    if (_currentIndex < _contacts.length) {
      // Auto dial next lead
      _dialCurrentContact();
    } else {
      _showCompletionDialog();
    }
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF12131A),
        title: const Text('All Leads Completed', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Excellent! You have dialed all allotted leads for today.',
          style: TextStyle(color: Color(0xFF9CA3AF)),
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
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF6366F1),
              onPrimary: Colors.white,
              surface: Color(0xFF12131A),
              onSurface: Colors.white,
            ),
            dialogBackgroundColor: const Color(0xFF0A0B10),
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
      return const Scaffold(
        backgroundColor: Color(0xFF0A0B10),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF6366F1)),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0A0B10),
        appBar: AppBar(
          backgroundColor: const Color(0xFF12131A),
          title: const Text('Dialer Workspace', style: TextStyle(color: Colors.white)),
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
                style: const TextStyle(color: Colors.white, fontSize: 16),
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

    final contact = _contacts[_currentIndex];
    final totalLeads = _contacts.length;
    final progress = (_currentIndex + 1) / totalLeads;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0B10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF12131A),
        title: Text(
          'Lead ${_currentIndex + 1} of $totalLeads',
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Progress Bar
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  backgroundColor: const Color(0xFF1E1F29),
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                ),
              ),
              const SizedBox(height: 24),

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
    );
  }

  Widget _buildContactPanel(dynamic contact) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF12131A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF222435)),
      ),
      child: Column(
        children: [
          const CircleAvatar(
            radius: 36,
            backgroundColor: Color(0xFF1E2030),
            child: Icon(Icons.person, size: 36, color: Color(0xFF9CA3AF)),
          ),
          const SizedBox(height: 16),
          Text(
            contact['name'],
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            contact['phone_number'],
            style: const TextStyle(fontSize: 16, letterSpacing: 0.5, color: Color(0xFF9CA3AF)),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0x1F6366F1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'Campaign: ${contact['campaign_name']}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF818CF8), fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 40),

          // Calling controls
          if (_isDialing) ...[
            const CircularProgressIndicator(color: Color(0xFF6366F1)),
            const SizedBox(height: 12),
            const Text('Dialing contact on SIM Network...', style: TextStyle(color: Color(0xFF9CA3AF))),
          ] else if (_isCallActive) ...[
            Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                    color: Color(0x1F10B981),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.call_made, color: Color(0xFF10B981), size: 28),
                ),
                const SizedBox(height: 12),
                Text(
                  _formatCallDuration(_callDurationSeconds),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text('Active Call Recording...', style: TextStyle(color: Color(0xFF10B981))),
              ],
            ),
          ] else ...[
            ElevatedButton(
              onPressed: _dialCurrentContact,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                backgroundColor: const Color(0xFF10B981),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.phone, color: Colors.white),
                  SizedBox(width: 8),
                  Text('Dial SIM Number', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: _toggleBreakState,
              icon: const Icon(Icons.coffee, color: Color(0xFFA855F7)),
              label: const Text(
                'Take a Break',
                style: TextStyle(
                  color: Color(0xFFA855F7),
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
          ]
        ],
      ),
    );
  }

  Widget _buildPostCallPanel() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF12131A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF222435)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'CALL DISCONNECTED',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.bold, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Text(
            'Duration: ${_formatCallDuration(_callDurationSeconds)}',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 20),

          // Outcome selector
          const Text('CALL OUTCOME', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isCallOutcomeConnected = true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _isCallOutcomeConnected ? const Color(0x1F10B981) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _isCallOutcomeConnected ? const Color(0xFF10B981) : const Color(0xFF222435),
                      ),
                    ),
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          'Connected',
                          style: TextStyle(
                            color: _isCallOutcomeConnected ? const Color(0xFF10B981) : const Color(0xFF9CA3AF),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isCallOutcomeConnected = false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: !_isCallOutcomeConnected ? const Color(0x1FEF4444) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: !_isCallOutcomeConnected ? const Color(0xFFEF4444) : const Color(0xFF222435),
                      ),
                    ),
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          'Missed / Unreachable',
                          style: TextStyle(
                            color: !_isCallOutcomeConnected ? const Color(0xFFEF4444) : const Color(0xFF9CA3AF),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Follow-up Picker
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Schedule Follow-Up?', style: TextStyle(color: Colors.white, fontSize: 14)),
            subtitle: Text(
              _followUpDate != null 
                  ? 'Selected: ${_followUpDate!.toLocal().toString().split(' ')[0]}' 
                  : 'Add lead to follow-up lists',
              style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
            ),
            trailing: TextButton(
              onPressed: _selectFollowUpDate,
              child: Text(
                _followUpDate != null ? 'Change Date' : 'Set Date',
                style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Feedback notes
          const Text('CALL NOTES / COMMENTS', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(
            controller: _feedbackController,
            style: const TextStyle(color: Colors.white),
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'Enter feedback or details about the call outcome...',
              hintStyle: const TextStyle(color: Color(0xFF4B5563), fontSize: 13),
              filled: true,
              fillColor: const Color(0xFF1E2030),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 24),

          // Countdown Timer Section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E2030),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  _isOnBreak 
                      ? 'Auto-Dialing Paused (On Break)' 
                      : 'Next auto-dialing initiates in $_countdownSeconds seconds...',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _toggleBreakState,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isOnBreak ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                          padding: const EdgeInsets.symmetric(vertical: 10),
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
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => _submitAndGoToNext(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          padding: const EdgeInsets.symmetric(vertical: 10),
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
    return Scaffold(
      backgroundColor: const Color(0xFF0A0B10),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: const Color(0x1FA855F7),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0x33A855F7), width: 2),
                    ),
                    child: const Icon(
                      Icons.coffee,
                      color: Color(0xFFA855F7),
                      size: 64,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                const Text(
                  'YOU ARE ON A BREAK',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Auto-dialing and call tracking are temporarily paused. Take your time to relax and recharge.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF9CA3AF),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 48),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF12131A),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF222435)),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'BREAK ELAPSED TIME',
                        style: TextStyle(
                          color: Color(0xFF9CA3AF),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _formatCallDuration(_telemetry.breakTime),
                        style: const TextStyle(
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFA855F7),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 48),
                ElevatedButton(
                  onPressed: _toggleBreakState,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    backgroundColor: const Color(0xFF6366F1),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 6,
                    shadowColor: const Color(0x4D6366F1),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_arrow, color: Colors.white, size: 24),
                      SizedBox(width: 8),
                      Text(
                        'Resume Dialer Workspace',
                        style: TextStyle(
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
      ),
    );
  }
}
