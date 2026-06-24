import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';

class ApiService {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static const String _baseUrl = "https://eazzio-tellecaller.onrender.com";
  static String? _token;
  static String? _lastStatus;

  static String get baseUrl => _baseUrl;

  // Initialize service settings
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    print('[ApiService] Using server: $_baseUrl');
  }

  static String? get token => _token;
  static bool get isAuthenticated => _token != null;

  // Force Logout session on session expiry or multi-device login
  static Future<void> forceLogout() async {
    _token = null;
    _lastStatus = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
    
    // Redirect to login screen
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }

  // User Auth - Login
  static Future<Map<String, dynamic>> login(String email, String companyRegNum) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': '',
          'companyRegNum': companyRegNum
        }),
      ).timeout(const Duration(seconds: 7));

      final Map<String, dynamic> data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        _token = data['token'];
        _lastStatus = 'online';
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _token!);
        await prefs.setString('user_name', data['user']['name'] ?? '');
        await prefs.setString('user_email', data['user']['email'] ?? '');
        return {'success': true, 'user': data['user']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Login failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Cannot connect to server: $e'};
    }
  }

  // Logout Session
  static Future<void> logout() async {
    // Notify server caller is offline before clearing token
    if (isAuthenticated) {
      await updateStatus('offline');
    }
    _token = null;
    _lastStatus = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
  }

  // Update caller status on server
  static Future<bool> updateStatus(String status) async {
    if (!isAuthenticated) return false;
    if (_lastStatus == status) {
      return true;
    }
    try {
      _lastStatus = status;
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/status'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({'status': status}),
      ).timeout(const Duration(seconds: 5));
      
      if (response.statusCode == 200) {
        return true;
      } else {
        if (response.statusCode == 401) {
          await forceLogout();
        }
        _lastStatus = null;
        return false;
      }
    } catch (e) {
      _lastStatus = null;
      print('Status update error: $e');
      return false;
    }
  }

  // Get allotted contacts for telecaller
  static Future<List<dynamic>> fetchAllottedContacts() async {
    if (!isAuthenticated) return [];
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/contacts/allotted'),
        headers: {
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
    } catch (e) {
      print('Error fetching contacts: $e');
    }
    return [];
  }

  // Submit Call Log & Upload Audio file
  static Future<bool> submitCallLog({
    required int contactId,
    required String callStatus,
    required int duration,
    required String feedback,
    required String? followUpDate,
    required String? recordingPath,
  }) async {
    if (!isAuthenticated) return false;
    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl/api/call-logs'),
      );

      // Headers
      request.headers['Authorization'] = 'Bearer $_token';

      // Fields
      request.fields['contactId'] = contactId.toString();
      request.fields['callStatus'] = callStatus;
      request.fields['duration'] = duration.toString();
      request.fields['feedback'] = feedback;
      if (followUpDate != null) {
        request.fields['followUpDate'] = followUpDate;
      }

      // Attach file if present
      if (recordingPath != null && recordingPath.isNotEmpty) {
        File file = File(recordingPath);
        if (await file.exists()) {
          request.files.add(
            await http.MultipartFile.fromPath(
              'recording',
              file.path,
              contentType: MediaType('audio', 'm4a'), // standard m4a recording output
            ),
          );
        }
      }

      var response = await request.send().timeout(const Duration(seconds: 15));
      if (response.statusCode == 201) {
        return true;
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
      return false;
    } catch (e) {
      print('Error uploading call log: $e');
      return false;
    }
  }

  // Sync session telemetry stats
  static Future<bool> syncTelemetry({
    required int workingTime,
    required int idleTime,
    required int breakTime,
    required int callingTime,
  }) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/call-logs/telemetry/sync'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'workingTime': workingTime,
          'idleTime': idleTime,
          'breakTime': breakTime,
          'callingTime': callingTime,
        }),
      ).timeout(const Duration(seconds: 5));
      
      if (response.statusCode == 200) {
        return true;
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
      return false;
    } catch (e) {
      print('Telemetry sync error: $e');
      return false;
    }
  }
}
