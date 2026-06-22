import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

class RecordingService {
  static final RecordingService _instance = RecordingService._internal();
  factory RecordingService() => _instance;
  RecordingService._internal();

  final AudioRecorder _audioRecorder = AudioRecorder();
  bool _isRecording = false;
  String? _lastRecordingPath;

  bool get isRecording => _isRecording;
  String? get lastRecordingPath => _lastRecordingPath;

  // Initialize and check permissions
  Future<bool> checkPermission() async {
    return await _audioRecorder.hasPermission();
  }

  // Start capturing audio
  Future<void> startRecording() async {
    try {
      if (_isRecording) return;

      final hasPermission = await checkPermission();
      if (!hasPermission) {
        print('Microphone permission denied. Cannot record.');
        return;
      }

      final tempDir = await getTemporaryDirectory();
      final path = '${tempDir.path}/call_rec_${DateTime.now().millisecondsSinceEpoch}.m4a';

      print('Starting recording to: $path');
      await _audioRecorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc),
        path: path,
      );

      _isRecording = true;
      _lastRecordingPath = path;
    } catch (e) {
      print('Failed to start recording: $e');
    }
  }

  // Stop capturing audio and return output path
  Future<String?> stopRecording() async {
    try {
      if (!_isRecording) return null;

      print('Stopping recording...');
      final path = await _audioRecorder.stop();
      _isRecording = false;
      
      if (path != null) {
        final file = File(path);
        if (await file.exists()) {
          print('Recording saved successfully. Size: ${await file.length()} bytes');
          _lastRecordingPath = path;
          return path;
        }
      }
    } catch (e) {
      print('Failed to stop recording: $e');
    }
    _isRecording = false;
    return null;
  }

  // Clean up resources
  void dispose() {
    _audioRecorder.dispose();
  }
}
