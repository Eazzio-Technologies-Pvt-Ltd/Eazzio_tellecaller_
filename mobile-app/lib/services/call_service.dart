import 'dart:async';
import 'package:phone_state/phone_state.dart';
import 'package:url_launcher/url_launcher.dart';

class CallService {
  static final CallService _instance = CallService._internal();
  factory CallService() => _instance;
  CallService._internal();

  final _callStateController = StreamController<PhoneStateStatus>.broadcast();
  StreamSubscription? _phoneStateSubscription;
  bool _isListening = false;

  Stream<PhoneStateStatus> get callStateStream => _callStateController.stream;

  // Start listening to physical SIM call events
  void startListening() {
    if (_isListening) return;

    try {
      _phoneStateSubscription = PhoneState.stream.listen((event) {
        print('Phone State Changed: ${event.status}');
        _callStateController.add(event.status);
      });
      _isListening = true;
      print('Phone state listener started.');
    } catch (e) {
      print('Failed to start phone state listener: $e');
    }
  }

  // Dial a phone number using physical SIM dialer
  Future<bool> dialNumber(String phoneNumber) async {
    final String cleanNumber = phoneNumber.replaceAll(RegExp(r'\s+\b'), '');
    final Uri telUri = Uri(scheme: 'tel', path: cleanNumber);
    
    try {
      if (await canLaunchUrl(telUri)) {
        print('Launching dialer for: $phoneNumber');
        return await launchUrl(telUri);
      } else {
        print('Could not launch dialer for uri: $telUri');
        return false;
      }
    } catch (e) {
      print('Error launching dialer: $e');
      return false;
    }
  }

  // Debug tool to simulate call states for emulator testing
  void simulateCallState(PhoneStateStatus status) {
    print('Simulated Call State: $status');
    _callStateController.add(status);
  }

  // Stop listening
  void stopListening() {
    _phoneStateSubscription?.cancel();
    _phoneStateSubscription = null;
    _isListening = false;
    print('Phone state listener stopped.');
  }

  void dispose() {
    stopListening();
    _callStateController.close();
  }
}
