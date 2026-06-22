package com.eazzio.eazzio_telecaller

import android.content.Intent
import android.content.Context
import android.app.ActivityManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.eazzio.eazzio_telecaller/app_control"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "bringToForeground") {
                var success = false
                
                // Method 1: Try bringing task to front (requires REORDER_TASKS)
                try {
                    val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                    activityManager.moveTaskToFront(taskId, ActivityManager.MOVE_TASK_WITH_HOME)
                    success = true
                } catch (e: Exception) {
                    android.util.Log.d("MainActivity", "moveTaskToFront failed: ${e.message}")
                }

                // Method 2: Try standard startActivity
                if (!success) {
                    try {
                        val intent = Intent(this, MainActivity::class.java)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                        startActivity(intent)
                        success = true
                    } catch (e: Exception) {
                        android.util.Log.d("MainActivity", "startActivity failed: ${e.message}")
                    }
                }

                // Method 3: Try system-delegated PendingIntent
                if (!success) {
                    try {
                        val intent = Intent(this, MainActivity::class.java)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                        val pendingIntent = android.app.PendingIntent.getActivity(
                            this,
                            0,
                            intent,
                            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                        )
                        pendingIntent.send()
                        success = true
                    } catch (e: Exception) {
                        android.util.Log.d("MainActivity", "PendingIntent failed: ${e.message}")
                    }
                }

                if (success) {
                    result.success(true)
                } else {
                    result.error("FOREGROUND_FAILED", "All foreground methods failed", null)
                }
            } else if (call.method == "checkCallLogPermission") {
                val granted = androidx.core.content.ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.READ_CALL_LOG
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                result.success(granted)
            } else if (call.method == "requestCallLogPermission") {
                androidx.core.app.ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.READ_CALL_LOG),
                    101
                )
                result.success(true)
            } else if (call.method == "getLastCallDetails") {
                try {
                    val cursor = contentResolver.query(
                        android.provider.CallLog.Calls.CONTENT_URI,
                        arrayOf(
                            android.provider.CallLog.Calls.NUMBER,
                            android.provider.CallLog.Calls.DURATION,
                            android.provider.CallLog.Calls.TYPE,
                            android.provider.CallLog.Calls.DATE
                        ),
                        null,
                        null,
                        "${android.provider.CallLog.Calls.DATE} DESC LIMIT 1"
                    )
                    
                    if (cursor != null && cursor.moveToFirst()) {
                        val numberIndex = cursor.getColumnIndex(android.provider.CallLog.Calls.NUMBER)
                        val durationIndex = cursor.getColumnIndex(android.provider.CallLog.Calls.DURATION)
                        val typeIndex = cursor.getColumnIndex(android.provider.CallLog.Calls.TYPE)
                        val dateIndex = cursor.getColumnIndex(android.provider.CallLog.Calls.DATE)
                        
                        val number = if (numberIndex != -1) cursor.getString(numberIndex) else ""
                        val duration = if (durationIndex != -1) cursor.getInt(durationIndex) else 0
                        val type = if (typeIndex != -1) cursor.getInt(typeIndex) else 0
                        val date = if (dateIndex != -1) cursor.getLong(dateIndex) else 0L
                        
                        cursor.close()
                        
                        val resultData = hashMapOf<String, Any>(
                            "number" to number,
                            "duration" to duration,
                            "type" to type,
                            "date" to date
                        )
                        result.success(resultData)
                    } else {
                        cursor?.close()
                        result.success(null)
                    }
                } catch (e: Exception) {
                    result.error("CALL_LOG_ERROR", e.message, null)
                }
            } else {
                result.notImplemented()
            }
        }
    }
}
