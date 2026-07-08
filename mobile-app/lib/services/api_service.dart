import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:eazzio_telecaller/screens/login_screen.dart';

class ApiService {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static String _baseUrl = "https://eazzio-tellecaller.onrender.com";
  static String? _token;
  static String? _lastStatus;

  static String get baseUrl => _baseUrl;

  // Initialize service settings
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    
    try {
      final envContent = await rootBundle.loadString('assets/.env');
      final lines = envContent.split('\n');
      for (var line in lines) {
        if (line.trim().startsWith('API_URL=')) {
          final url = line.substring(line.indexOf('=') + 1).trim();
          if (url.isNotEmpty) {
            _baseUrl = url;
            print('[ApiService] Loaded baseUrl from assets/.env: $_baseUrl');
            break;
          }
        }
      }
    } catch (e) {
      print('[ApiService] Could not load assets/.env or failed to parse: $e. Using default: $_baseUrl');
    }
    print('[ApiService] Active server URL: $_baseUrl');
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
    await prefs.remove('user_role');
    
    // Redirect to login screen
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }

  // User Auth - Login
  static Future<Map<String, dynamic>> login({
    required String email,
    String? password,
    String? companyRegNum,
  }) async {
    try {
      final bodyMap = {
        'email': email,
        'password': password ?? '',
      };
      if (companyRegNum != null && companyRegNum.isNotEmpty) {
        bodyMap['companyRegNum'] = companyRegNum;
      }
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(bodyMap),
      ).timeout(const Duration(seconds: 7));

      final Map<String, dynamic> data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        _token = data['token'];
        _lastStatus = 'online';
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _token!);
        await prefs.setString('user_name', data['user']['name'] ?? '');
        await prefs.setString('user_email', data['user']['email'] ?? '');
        await prefs.setString('user_role', data['user']['role'] ?? '');
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
      final prefs = await SharedPreferences.getInstance();
      final role = prefs.getString('user_role') ?? 'telecaller';
      if (role == 'telecaller') {
        await updateStatus('offline');
      }
    }
    _token = null;
    _lastStatus = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
    await prefs.remove('user_role');
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
    String? calledAt,
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
      if (calledAt != null) {
        request.fields['calledAt'] = calledAt;
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

  // ── Company Admin Dashboard Client APIs ──

  static Future<Map<String, dynamic>> fetchAnalytics({int? telecallerId, String? date}) async {
    if (!isAuthenticated) return {};
    try {
      var urlStr = '$_baseUrl/api/call-logs/analytics';
      final List<String> params = [];
      if (telecallerId != null) params.add('telecallerId=$telecallerId');
      if (date != null) params.add('date=$date');
      if (params.isNotEmpty) {
        urlStr += '?${params.join('&')}';
      }
      final response = await http.get(
        Uri.parse(urlStr),
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
      print('Error fetching analytics: $e');
    }
    return {};
  }

  static Future<List<dynamic>> fetchCallLogs({int? telecallerId, String? date}) async {
    if (!isAuthenticated) return [];
    try {
      var urlStr = '$_baseUrl/api/call-logs';
      final List<String> params = [];
      if (telecallerId != null) params.add('telecallerId=$telecallerId');
      if (date != null) params.add('date=$date');
      if (params.isNotEmpty) {
        urlStr += '?${params.join('&')}';
      }
      final response = await http.get(
        Uri.parse(urlStr),
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
      print('Error fetching call logs: $e');
    }
    return [];
  }

  static Future<List<dynamic>> fetchCampaigns() async {
    if (!isAuthenticated) return [];
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/campaigns'),
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
      print('Error fetching campaigns: $e');
    }
    return [];
  }

  static Future<Map<String, dynamic>> createCampaign(String name, String description) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Unauthenticated'};
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/campaigns'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'name': name,
          'description': description,
        }),
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 201) {
        return {'success': true, 'campaign': jsonDecode(response.body)};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'error': errorData['error'] ?? 'Failed to create campaign'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error: $e'};
    }
  }

  static Future<bool> updateCampaignStatus(int campaignId, String status) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.put(
        Uri.parse('$_baseUrl/api/campaigns/$campaignId/status'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({'status': status}),
      ).timeout(const Duration(seconds: 7));
      return response.statusCode == 200;
    } catch (e) {
      print('Error updating campaign status: $e');
      return false;
    }
  }

  static Future<bool> deleteCampaign(int campaignId) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.delete(
        Uri.parse('$_baseUrl/api/campaigns/$campaignId'),
        headers: {
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 7));
      return response.statusCode == 200;
    } catch (e) {
      print('Error deleting campaign: $e');
      return false;
    }
  }

  static Future<Map<String, dynamic>> registerTelecaller(String name, String email, String password) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Unauthenticated'};
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/register'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'name': name,
          'email': email,
          'password': password,
          'role': 'telecaller',
        }),
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 201) {
        return {'success': true};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'error': errorData['error'] ?? 'Failed to register telecaller'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> editTelecaller(int id, String name, String email) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Unauthenticated'};
    try {
      final response = await http.put(
        Uri.parse('$_baseUrl/api/auth/telecallers/$id'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'name': name,
          'email': email,
        }),
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 200) {
        return {'success': true};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'error': errorData['error'] ?? 'Failed to update telecaller'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error: $e'};
    }
  }

  static Future<bool> deleteTelecaller(int telecallerId) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.delete(
        Uri.parse('$_baseUrl/api/auth/$telecallerId'),
        headers: {
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 7));
      return response.statusCode == 200;
    } catch (e) {
      print('Error deleting telecaller: $e');
      return false;
    }
  }

  static Future<Map<String, dynamic>> fetchCompanyBilling() async {
    if (!isAuthenticated) return {};
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/auth/company-billing'),
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
      print('Error fetching company billing: $e');
    }
    return {};
  }
}
