import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:eazzio_telecaller/screens/login_screen.dart';
import 'package:eazzio_telecaller/services/telemetry_service.dart';


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
    await prefs.remove('user_role');

    await TelemetryService().resetSession();
    
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
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('user_role') ?? 'telecaller';
    if (role == 'telecaller') {
      await TelemetryService().resetSession();
    } else {
      if (isAuthenticated) {
        await updateStatus('offline');
      }
    }
    _token = null;
    _lastStatus = null;
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

  // Change Password
  static Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Not authenticated'};
    try {
      final response = await http.put(
        Uri.parse('$_baseUrl/api/auth/change-password'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        }),
      ).timeout(const Duration(seconds: 10));

      final Map<String, dynamic> data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Password updated successfully'};
      } else {
        if (response.statusCode == 401) {
          await forceLogout();
        }
        return {'success': false, 'error': data['error'] ?? 'Failed to change password'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Server error: $e'};
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

  // Sync session telemetry stats — returns server-corrected values or null on failure
  static Future<Map<String, dynamic>?> syncTelemetry({
    required int workingTime,
    required int idleTime,
    required int breakTime,
    required int callingTime,
  }) async {
    if (!isAuthenticated) return null;
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
        final data = jsonDecode(response.body);
        // Return serverValues map so caller can reconcile local counters
        return data['serverValues'] as Map<String, dynamic>?;
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
      return null;
    } catch (e) {
      print('Telemetry sync error: $e');
      return null;
    }
  }

  // Fetch today's telemetry session stats
  static Future<Map<String, dynamic>?> fetchTodayTelemetry() async {
    if (!isAuthenticated) return null;
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/call-logs/telemetry/today'),
        headers: {
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
    } catch (e) {
      print('Error fetching today telemetry: $e');
    }
    return null;
  }

  // Sync call activities to backend
  static Future<bool> syncCallActivities(List<Map<String, dynamic>> activities) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/call-logs/activities'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({'activities': activities}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return true;
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
      return false;
    } catch (e) {
      print('Error syncing call activities: $e');
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

  // Send Forgot Password OTP
  static Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/forgot-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      ).timeout(const Duration(seconds: 7));

      final Map<String, dynamic> data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Verification code sent.'};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to send verification code.'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Cannot connect to server: $e'};
    }
  }

  // Reset Password using OTP
  static Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'otp': otp,
          'newPassword': newPassword,
        }),
      ).timeout(const Duration(seconds: 7));

      final Map<String, dynamic> data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Password reset successful.'};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to reset password.'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Cannot connect to server: $e'};
    }
  }

  // Fetch overdue follow-up leads for admin
  static Future<List<dynamic>> fetchOverdueFollowUps() async {
    if (!isAuthenticated) return [];
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/contacts/overdue-follow-ups'),
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
      print('Error fetching overdue follow-ups: $e');
    }
    return [];
  }

  // Reassign single contact
  static Future<bool> reassignContact(int contactId, int? telecallerId) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.put(
        Uri.parse('$_baseUrl/api/contacts/$contactId/assign'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'telecallerId': telecallerId,
        }),
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 200) {
        return true;
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
      return false;
    } catch (e) {
      print('Error reassigning contact: $e');
      return false;
    }
  }

  // Bulk transfer contacts
  static Future<bool> bulkTransferContacts(List<int> contactIds, int? telecallerId) async {
    if (!isAuthenticated) return false;
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/contacts/bulk-transfer'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'contactIds': contactIds,
          'telecallerId': telecallerId,
        }),
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 200) {
        return true;
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
      return false;
    } catch (e) {
      print('Error bulk transferring contacts: $e');
      return false;
    }
  }

  // Add a single lead to a campaign
  static Future<Map<String, dynamic>> addLead({
    required int campaignId,
    required String name,
    required String phoneNumber,
  }) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Unauthenticated'};
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/contacts/add-lead'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'campaignId': campaignId,
          'name': name,
          'phoneNumber': phoneNumber,
        }),
      ).timeout(const Duration(seconds: 7));
      
      final Map<String, dynamic> data = jsonDecode(response.body);
      if (response.statusCode == 201) {
        return {'success': true, 'message': data['message'] ?? 'Lead added successfully.'};
      } else {
        return {'success': false, 'error': data['message'] ?? data['error'] ?? 'Failed to add lead.'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Connection error: $e'};
    }
  }

  // Fetch all contacts filtered by campaign or status
  static Future<List<dynamic>> fetchContacts({int? campaignId, String? status, String? search}) async {
    if (!isAuthenticated) return [];
    try {
      var urlStr = '$_baseUrl/api/contacts';
      final List<String> params = [];
      if (campaignId != null) params.add('campaignId=$campaignId');
      if (status != null) params.add('status=$status');
      if (search != null) params.add('search=$search');
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
      print('Error fetching contacts: $e');
    }
    return [];
  }

  // Fetch call logs for a specific contact
  static Future<List<dynamic>> fetchCallLogsForContact(int contactId) async {
    if (!isAuthenticated) return [];
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/call-logs?contactId=$contactId'),
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
      print('Error fetching call logs for contact: $e');
    }
    return [];
  }

  // Update profile details (Name and profile photo)
  static Future<Map<String, dynamic>> updateProfile({
    required String name,
    String? imagePath,
  }) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Not authenticated'};
    try {
      final request = http.MultipartRequest(
        'PUT',
        Uri.parse('$_baseUrl/api/auth/profile'),
      );

      // Headers
      request.headers['Authorization'] = 'Bearer $_token';

      // Fields
      request.fields['name'] = name;

      // Attach file if present
      if (imagePath != null && imagePath.isNotEmpty) {
        final file = File(imagePath);
        if (await file.exists()) {
          request.files.add(
            await http.MultipartFile.fromPath(
              'profile_photo',
              file.path,
              contentType: MediaType('image', 'jpeg'),
            ),
          );
        }
      }

      final streamedResponse = await request.send().timeout(const Duration(seconds: 15));
      final response = await http.Response.fromStream(streamedResponse);
      final Map<String, dynamic> data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Profile updated', 'user': data['user']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Profile update failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Cannot connect to server: $e'};
    }
  }

  // Fetch current user details
  static Future<Map<String, dynamic>?> fetchMe() async {
    if (!isAuthenticated) return null;
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/auth/me'),
        headers: {
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        await forceLogout();
      }
    } catch (e) {
      print('Error fetching current user info: $e');
    }
    return null;
  }

  // Fetch company colleagues (other telecallers)
  static Future<List<dynamic>> fetchColleagues() async {
    if (!isAuthenticated) return [];
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/auth/colleagues'),
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
      print('Error fetching colleagues: $e');
    }
    return [];
  }

  // Request lead transfer to another telecaller
  static Future<Map<String, dynamic>> requestLeadTransfer({
    required int contactId,
    required int toUserId,
    String? reason,
  }) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Not authenticated'};
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/contacts/transfer-request'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'contactId': contactId,
          'toUserId': toUserId,
          'reason': reason ?? '',
        }),
      ).timeout(const Duration(seconds: 7));

      final Map<String, dynamic> data = jsonDecode(response.body);
      if (response.statusCode == 201) {
        return {'success': true, 'message': data['message'] ?? 'Transfer request submitted', 'transfer': data['transfer']};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Transfer request failed'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Cannot connect to server: $e'};
    }
  }

  // Fetch transfer requests
  static Future<List<dynamic>> fetchTransferRequests() async {
    if (!isAuthenticated) return [];
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/contacts/transfer-requests'),
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
      print('Error fetching transfer requests: $e');
    }
    return [];
  }

  // Respond to transfer request
  static Future<Map<String, dynamic>> respondToTransferRequest({
    required int transferId,
    required String status,
  }) async {
    if (!isAuthenticated) return {'success': false, 'error': 'Not authenticated'};
    try {
      final response = await http.put(
        Uri.parse('$_baseUrl/api/contacts/transfer-requests/$transferId/respond'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'status': status,
        }),
      ).timeout(const Duration(seconds: 7));

      final Map<String, dynamic> data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Responded successfully'};
      } else {
        return {'success': false, 'error': data['error'] ?? 'Failed to respond'};
      }
    } catch (e) {
      return {'success': false, 'error': 'Cannot connect to server: $e'};
    }
  }

  // Increment WhatsApp count
  static Future<Map<String, dynamic>> incrementWhatsappCount() async {
    if (!isAuthenticated) return {'success': false, 'error': 'Not authenticated'};
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/auth/increment-whatsapp'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 7));
      if (response.statusCode == 200) {
        return {'success': true, 'message': 'WhatsApp count incremented'};
      }
    } catch (e) {
      print('Error incrementing WhatsApp count: $e');
    }
    return {'success': false, 'error': 'Failed to increment WhatsApp count'};
  }
}

