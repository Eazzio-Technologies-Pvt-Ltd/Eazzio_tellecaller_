package com.eazzio.eazzio_telecaller

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
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
            // Run call check in a background thread
            Thread {
                processLastCall()
            }.start()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

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
        ) {
            return
        }

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

                // Check if the call ended recently (within the last 60 seconds)
                val diffSeconds = (System.currentTimeMillis() - date) / 1000
                if (diffSeconds > 60) {
                    return
                }

                // Check if this number is in our allotted list in SharedPreferences
                val prefs = getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
                val allottedString = prefs.getString("flutter.allotted_phone_numbers", "") ?: ""
                val allottedList = allottedString.split(",").map { it.trim().replace(Regex("\\D"), "") }
                
                val cleanNumber = number.replace(Regex("\\D"), "")
                if (cleanNumber.isEmpty()) return

                val isMatched = allottedList.any { 
                    it.endsWith(cleanNumber) || cleanNumber.endsWith(it)
                }

                if (isMatched) {
                    // Map Call Type
                    var callStatus = "missed"
                    if (type == CallLog.Calls.OUTGOING_TYPE) {
                        callStatus = if (duration > 0) "connected" else "non_connected"
                    } else if (type == CallLog.Calls.INCOMING_TYPE) {
                        callStatus = if (duration > 0) "received" else "missed"
                    } else if (type == CallLog.Calls.MISSED_TYPE || type == CallLog.Calls.REJECTED_TYPE) {
                        callStatus = "missed"
                    } else {
                        return
                    }

                    // Format Timestamp to UTC ISO8601
                    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                    sdf.timeZone = TimeZone.getTimeZone("UTC")
                    val isoTimestamp = sdf.format(Date(date))

                    // Save to SQLite pending_sync table
                    saveToLocalDb(cleanNumber, callStatus, duration, isoTimestamp)

                    // Trigger Sync
                    syncLogsToServer()
                }
            } else {
                cursor?.close()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun saveToLocalDb(phoneNumber: String, callType: String, duration: Int, timestamp: String) {
        var db: SQLiteDatabase? = null
        try {
            val dbFile = getDatabasePath("call_log_sync.db")
            db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
            
            // Ensure table exists just in case
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS pending_sync (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                        "phone_number TEXT, " +
                        "call_type TEXT, " +
                        "duration_seconds INTEGER, " +
                        "timestamp TEXT, " +
                        "synced INTEGER DEFAULT 0, " +
                        "UNIQUE(phone_number, timestamp) ON CONFLICT IGNORE" +
                        ")"
            )

            val values = ContentValues().apply {
                put("phone_number", phoneNumber)
                put("call_type", callType)
                put("duration_seconds", duration)
                put("timestamp", timestamp)
                put("synced", 0)
            }

            db.insertWithOnConflict("pending_sync", null, values, SQLiteDatabase.CONFLICT_IGNORE)
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            db?.close()
        }
    }

    private fun syncLogsToServer() {
        var db: SQLiteDatabase? = null
        try {
            val dbFile = getDatabasePath("call_log_sync.db")
            if (!dbFile.exists()) return

            db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
            val cursor = db.rawQuery("SELECT id, phone_number, call_type, duration_seconds, timestamp FROM pending_sync WHERE synced = 0", null)
            
            val unsyncedList = mutableListOf<Map<String, Any>>()
            val ids = mutableListOf<Int>()

            if (cursor.moveToFirst()) {
                val idCol = cursor.getColumnIndex("id")
                val phoneCol = cursor.getColumnIndex("phone_number")
                val typeCol = cursor.getColumnIndex("call_type")
                val durCol = cursor.getColumnIndex("duration_seconds")
                val timeCol = cursor.getColumnIndex("timestamp")

                do {
                    val id = cursor.getInt(idCol)
                    val phone = cursor.getString(phoneCol)
                    val type = cursor.getString(typeCol)
                    val duration = cursor.getInt(durCol)
                    val timestamp = cursor.getString(timeCol)

                    unsyncedList.add(
                        mapOf(
                            "phoneNumber" to phone,
                            "callType" to type,
                            "durationSeconds" to duration,
                            "timestamp" to timestamp
                        )
                    )
                    ids.add(id)
                } while (cursor.moveToNext())
            }
            cursor.close()

            if (unsyncedList.isEmpty()) return

            val prefs = getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
            val token = prefs.getString("flutter.auth_token", null)
            val baseUrl = "https://eazzio-tellecaller.onrender.com" // Default fallback URL

            if (token != null) {
                val jsonPayload = JSONObject().apply {
                    val array = JSONArray()
                    for (item in unsyncedList) {
                        array.put(JSONObject(item))
                    }
                    put("activities", array)
                }

                val success = postSyncCall(baseUrl, token, jsonPayload.toString())
                if (success) {
                    // Update rows to synced = 1
                    db.beginTransaction()
                    try {
                        for (id in ids) {
                            db.execSQL("UPDATE pending_sync SET synced = 1 WHERE id = $id")
                        }
                        db.setTransactionSuccessful()
                    } finally {
                        db.endTransaction()
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            db?.close()
        }
    }

    private fun postSyncCall(baseUrl: String, token: String, jsonString: String): Boolean {
        var connection: HttpURLConnection? = null
        try {
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
            return responseCode == 200 || responseCode == 201
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        } finally {
            connection?.disconnect()
        }
    }
}
