import 'dart:async';
import 'package:eazzio_telecaller/services/api_service.dart';

enum TelemetryState {
  idle,
  calling,
  onBreak
}

class TelemetryService {
  static final TelemetryService _instance = TelemetryService._internal();
  factory TelemetryService() => _instance;
  TelemetryService._internal();

  Timer? _timer;
  TelemetryState _currentState = TelemetryState.idle;
  bool shiftCompleteShown = false;

  // Session counters in seconds
  int _workingTime = 0;
  int _talkTime = 0;
  int _breakTime = 0;
  int _idleTime = 0;

  // Track daily call totals locally for UI representation
  int connectedCalls = 0;
  int missedCalls = 0;

  int get workingTime => _workingTime;
  int get talkTime => _talkTime;
  int get breakTime => _breakTime;
  int get idleTime => _idleTime;

  bool get isActive => _timer != null;
  TelemetryState get currentState => _currentState;

  // Start the daily telemetry session
  void startSession() {
    if (_timer != null) return;
    
    // Set status online
    ApiService.updateStatus('online');
    _currentState = TelemetryState.idle;

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
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
  void stopSession() {
    _timer?.cancel();
    _timer = null;
    _syncWithServer();
    ApiService.updateStatus('offline');
  }

  void resetSession() {
    stopSession();
    _workingTime = 0;
    _talkTime = 0;
    _breakTime = 0;
    _idleTime = 0;
    connectedCalls = 0;
    missedCalls = 0;
    shiftCompleteShown = false;
  }

  // Sync session timer data
  Future<void> _syncWithServer() async {
    if (!ApiService.isAuthenticated) return;
    await ApiService.syncTelemetry(
      workingTime: _workingTime,
      idleTime: _idleTime,
      breakTime: _breakTime,
      callingTime: _talkTime,
    );
  }
}
