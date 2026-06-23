import 'dart:async';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:phone_state/phone_state.dart';
import 'package:url_launcher/url_launcher.dart';

class CallService {
  static final CallService _instance = CallService._internal();
  factory CallService() => _instance;
  
  CallService._internal() {
    loadSavedSim();
  }

  final _callStateController = StreamController<PhoneStateStatus>.broadcast();
  StreamSubscription? _phoneStateSubscription;
  bool _isListening = false;

  int? selectedSlotIndex;
  int? selectedSubscriptionId;
  String? selectedSimLabel;

  Stream<PhoneStateStatus> get callStateStream => _callStateController.stream;

  // Load saved SIM choice from shared preferences
  Future<void> loadSavedSim() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      selectedSlotIndex = prefs.getInt('selected_sim_slot');
      selectedSubscriptionId = prefs.getInt('selected_sim_sub_id');
      selectedSimLabel = prefs.getString('selected_sim_label');
      print('Loaded SIM selection: Slot $selectedSlotIndex, SubId $selectedSubscriptionId, Label $selectedSimLabel');
    } catch (e) {
      print('Error loading saved SIM selection: $e');
    }
  }

  // Save SIM choice to shared preferences
  Future<void> saveSimSelection(int? slotIndex, int? subscriptionId, String? label) async {
    selectedSlotIndex = slotIndex;
    selectedSubscriptionId = subscriptionId;
    selectedSimLabel = label;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (slotIndex == null) {
        await prefs.remove('selected_sim_slot');
        await prefs.remove('selected_sim_sub_id');
        await prefs.remove('selected_sim_label');
      } else {
        await prefs.setInt('selected_sim_slot', slotIndex);
        await prefs.setInt('selected_sim_sub_id', subscriptionId ?? -1);
        await prefs.setString('selected_sim_label', label ?? '');
      }
      print('Saved SIM selection: Slot $slotIndex, SubId $subscriptionId, Label $label');
    } catch (e) {
      print('Error saving SIM selection: $e');
    }
  }

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
    if (selectedSlotIndex != null) {
      try {
        const channel = MethodChannel('com.eazzio.eazzio_telecaller/app_control');
        print('Dialing using selected SIM slot: $selectedSlotIndex (Subscription: $selectedSubscriptionId)');
        final bool result = await channel.invokeMethod('dialWithSim', {
          'phoneNumber': phoneNumber,
          'slotIndex': selectedSlotIndex,
          'subscriptionId': selectedSubscriptionId,
        }) ?? false;
        return result;
      } catch (e) {
        print('Native SIM dialer failed, falling back to default dialer: $e');
      }
    }

    final String cleanNumber = phoneNumber.replaceAll(RegExp(r'\s+\b'), '');
    final Uri telUri = Uri(scheme: 'tel', path: cleanNumber);
    
    try {
      if (await canLaunchUrl(telUri)) {
        print('Launching default dialer for: $phoneNumber');
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
