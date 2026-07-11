import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:eazzio_telecaller/services/api_service.dart';

enum TelemetryState {
  idle,
  calling,
  onBreak
}

class TelemetryService with WidgetsBindingObserver {
  static final TelemetryService _instance = TelemetryService._internal();
  factory TelemetryService() => _instance;
  TelemetryService._internal() {
    WidgetsBinding.instance.addObserver(this);
  }

  Timer? _timer;
  TelemetryState _currentState = TelemetryState.idle;
  bool shiftCompleteShown = false;
  bool _isAppPaused = false;
  String _sessionDate = '';
  bool _isInitialized = false;

  bool get isInitialized => _isInitialized;

  String getTrackingDate([DateTime? dt]) {
    final now = dt ?? DateTime.now();
    // Convert to UTC first, then shift by exactly 5 hours and 30 minutes to get Asia/Kolkata (IST) time
    final istTime = now.toUtc().add(const Duration(hours: 5, minutes: 30));
    final year = istTime.year;
    final month = istTime.month.toString().padLeft(2, '0');
    final day = istTime.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  // Session counters in seconds
  int _workingTime = 0;
  int _talkTime = 0;
  int _breakTime = 0;
  int _idleTime = 0;

  // Company shift limits (fetched from server)
  int _workTimeLimitHours = 8;
  int _talkTimeLimitHours = 4;

  // Track daily call totals locally for UI representation
  int connectedCalls = 0;
  int missedCalls = 0;
  int nonConnectedCalls = 0;
  int receivedCalls = 0;

  int connectedDuration = 0;
  int missedDuration = 0;
  int nonConnectedDuration = 0;
  int receivedDuration = 0;

  int get workingTime => _workingTime;
  int get talkTime => _talkTime;
  int get breakTime => _breakTime;
  int get idleTime => _idleTime;
  int get workTimeLimitHours => _workTimeLimitHours;
  int get talkTimeLimitHours => _talkTimeLimitHours;

  bool get isActive => _timer != null;
  TelemetryState get currentState => _currentState;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _handleAppBackground();
    } else if (state == AppLifecycleState.resumed) {
      _handleAppForeground();
    }
  }

  void _handleAppBackground() {
    if (_currentState != TelemetryState.calling && isActive) {
      _isAppPaused = true;
      ApiService.updateStatus('offline');
      _syncWithServer();
    }
  }

  void _handleAppForeground() async {
    if (_isAppPaused && isActive) {
      if (_currentState == TelemetryState.onBreak) {
        ApiService.updateStatus('break');
      } else {
        ApiService.updateStatus('online');
      }
      await initializeSessionFromServer();
      _isAppPaused = false;
    }
  }

  // Start the daily telemetry session
  Future<void> startSession() async {
    if (_timer != null) return;
    
    _isInitialized = false;
    // Set status online
    ApiService.updateStatus('online');
    _currentState = TelemetryState.idle;
    _isAppPaused = false;
    _sessionDate = getTrackingDate();

    // Fetch initial daily stats from server
    await initializeSessionFromServer();

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_isAppPaused || !_isInitialized) return;

      // Check for 12:00 AM boundary crossover
      final currentTrackingDate = getTrackingDate();
      if (currentTrackingDate != _sessionDate) {
        _sessionDate = currentTrackingDate;
        _workingTime = 0;
        _talkTime = 0;
        _breakTime = 0;
        _idleTime = 0;
        connectedCalls = 0;
        missedCalls = 0;
        nonConnectedCalls = 0;
        receivedCalls = 0;
        connectedDuration = 0;
        missedDuration = 0;
        nonConnectedDuration = 0;
        receivedDuration = 0;
        _syncWithServer();
      }

      if (_currentState != TelemetryState.onBreak) {
        _workingTime++;
      }
      
      switch (_currentState) {
        case TelemetryState.idle:
          _idleTime++;
          break;
        case TelemetryState.onBreak:
          _breakTime++;
          if (_breakTime >= 7200) {
            setBreakState(false);
          }
          break;
        case TelemetryState.calling:
          _talkTime++;
          break;
      }

      // Auto-sync to server every 15 seconds
      if (timer.tick % 15 == 0) {
        _syncWithServer();
      }
    });
  }

  // Fetch today's telemetry stats from server to initialize cumulative timing
  Future<void> initializeSessionFromServer() async {
    if (!ApiService.isAuthenticated) return;
    try {
      final data = await ApiService.fetchTodayTelemetry();
      if (data != null && data['success'] == true) {
        final telemetry = data['telemetry'];
        final calls = data['calls'];
        
        _workingTime = telemetry['workingTime'] ?? 0;
        _talkTime = telemetry['talkTime'] ?? 0;
        _breakTime = telemetry['breakTime'] ?? 0;
        _idleTime = telemetry['idleTime'] ?? 0;
        _workTimeLimitHours = telemetry['workTimeLimitHours'] ?? 8;
        _talkTimeLimitHours = telemetry['talkTimeLimitHours'] ?? 4;
        
        connectedCalls = calls['connected'] ?? 0;
        nonConnectedCalls = calls['nonConnected'] ?? 0;
        receivedCalls = calls['received'] ?? 0;
        missedCalls = calls['missed'] ?? 0;

        connectedDuration = calls['connectedDuration'] ?? 0;
        nonConnectedDuration = calls['nonConnectedDuration'] ?? 0;
        receivedDuration = calls['receivedDuration'] ?? 0;
        missedDuration = calls['missedDuration'] ?? 0;
        
        _isInitialized = true;
        print('[TelemetryService] Session initialized from server: workingTime=$_workingTime, talkTime=$_talkTime, breakTime=$_breakTime, idleTime=$_idleTime');
      }
    } catch (e) {
      print('[TelemetryService] Error initializing session from server: $e');
      _isInitialized = true; // allow tracking fallback if server fails
    }
  }

  // Set Caller state to break
  void setBreakState(bool onBreak) {
    if (onBreak) {
      if (_breakTime >= 7200) {
        print('[TelemetryService] Break limit of 2 hours reached. Cannot take more break.');
        return;
      }
      _currentState = TelemetryState.onBreak;
      ApiService.updateStatus('break');
    } else {
      _currentState = TelemetryState.idle;
      ApiService.updateStatus('online');
    }
    _syncWithServer();
  }

  // Set Caller state to calling
  void setCallingState(bool isCalling) {
    if (isCalling) {
      _currentState = TelemetryState.calling;
      ApiService.updateStatus('calling');
    } else {
      _currentState = TelemetryState.idle;
      ApiService.updateStatus('online');
    }
    _syncWithServer();
  }

  // Clear session variables
  Future<void> stopSession() async {
    _timer?.cancel();
    _timer = null;
    _isAppPaused = false;
    await _syncWithServer();
    await ApiService.updateStatus('offline');
  }

  Future<void> resetSession() async {
    await stopSession();
    _workingTime = 0;
    _talkTime = 0;
    _breakTime = 0;
    _idleTime = 0;
    connectedCalls = 0;
    missedCalls = 0;
    nonConnectedCalls = 0;
    receivedCalls = 0;
    connectedDuration = 0;
    missedDuration = 0;
    nonConnectedDuration = 0;
    receivedDuration = 0;
    shiftCompleteShown = false;
  }

  // Sync session timer data
  Future<void> _syncWithServer() async {
    if (!ApiService.isAuthenticated || !_isInitialized) return;
    await ApiService.syncTelemetry(
      workingTime: _workingTime,
      idleTime: _idleTime,
      breakTime: _breakTime,
      callingTime: _talkTime,
    );
  }
}
