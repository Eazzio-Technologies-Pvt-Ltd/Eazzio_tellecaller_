package com.eazzio.eazzio_telecaller

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.provider.CallLog
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class CallTrackingService : Service() {

    private val CHANNEL_ID = "com.eazzio.eazzio_telecaller.background_sync"
    private val NOTIFICATION_ID = 2026

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, getNotification("Eazzio call tracking is running in the background."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null && intent.getBooleanExtra("check_last_call", false)) {
            Thread {
                processLastCall()
            }.start()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Call Tracking Service",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description = "Keeps Eazzio CRM active in the background to log phone calls."
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun getNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Eazzio CRM Active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun processLastCall() {
        if (androidx.core.content.ContextCompat.checkSelfPermission(
                this,
                android.Manifest.permission.READ_CALL_LOG
            ) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return

        try {
            val cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE
                ),
                null,
                null,
                "${CallLog.Calls.DATE} DESC LIMIT 1"
            )

            if (cursor != null && cursor.moveToFirst()) {
                val numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val durationIndex = cursor.getColumnIndex(CallLog.Calls.DURATION)
                val typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE)
                val dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE)

                val number = if (numberIndex != -1) cursor.getString(numberIndex) else ""
                val duration = if (durationIndex != -1) cursor.getInt(durationIndex) else 0
                val type = if (typeIndex != -1) cursor.getInt(typeIndex) else 0
                val date = if (dateIndex != -1) cursor.getLong(dateIndex) else 0L
                cursor.close()

                // Only process calls that ended within the last 60 seconds
                val diffSeconds = (System.currentTimeMillis() - date) / 1000
                if (diffSeconds > 60) return

                val prefs = getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)

                // ── Timestamp guard: skip if already confirmed-synced by Flutter-side poll ──
                val lastSynced = prefs.getLong("flutter.last_synced_call_timestamp", 0L)
                if (date <= lastSynced) return

                // ── Allotted-number check ──
                val allottedString = prefs.getString("flutter.allotted_phone_numbers", "") ?: ""
                val allottedList = allottedString.split(",").map { it.trim().replace(Regex("\\D"), "") }

                val cleanNumber = number.replace(Regex("\\D"), "")
                if (cleanNumber.isEmpty()) return

                val isMatched = allottedList.any {
                    it.endsWith(cleanNumber) || cleanNumber.endsWith(it)
                }
                if (!isMatched) return

                // ── Map call type ──
                val callStatus = when {
                    type == CallLog.Calls.OUTGOING_TYPE -> if (duration > 0) "connected" else "non_connected"
                    type == CallLog.Calls.INCOMING_TYPE -> if (duration > 0) "received" else "missed"
                    type == CallLog.Calls.MISSED_TYPE || type == CallLog.Calls.REJECTED_TYPE -> "missed"
                    else -> return
                }

                // ── Format timestamp to UTC ISO8601 ──
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val isoTimestamp = sdf.format(Date(date))

                // ── Build and POST payload directly ──
                val payload = JSONObject().apply {
                    put("activities", JSONArray().apply {
                        put(JSONObject().apply {
                            put("phoneNumber", cleanNumber)
                            put("callType", callStatus)
                            put("durationSeconds", duration)
                            put("timestamp", isoTimestamp)
                        })
                    })
                }

                val token = prefs.getString("flutter.auth_token", null) ?: return
                val baseUrl = "https://eazzio-tellecaller.onrender.com"
                val success = postSyncCall(baseUrl, token, payload.toString())

                if (success) {
                    // Max-value guard: never overwrite a higher timestamp set concurrently by Flutter side
                    val currentStored = prefs.getLong("flutter.last_synced_call_timestamp", 0L)
                    val newValue = if (date > currentStored) date else currentStored
                    prefs.edit().putLong("flutter.last_synced_call_timestamp", newValue).apply()
                }
                // On failure: do not update timestamp — the Dart-side periodic sync will
                // re-query the native call log and pick this call up on next attempt.
            } else {
                cursor?.close()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun postSyncCall(baseUrl: String, token: String, jsonString: String): Boolean {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL("$baseUrl/api/call-logs/activities")
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")

            val writer = OutputStreamWriter(connection.outputStream)
            writer.write(jsonString)
            writer.flush()
            writer.close()

            val responseCode = connection.responseCode
            responseCode == 200 || responseCode == 201
        } catch (e: Exception) {
            e.printStackTrace()
            false
        } finally {
            connection?.disconnect()
        }
    }
}

