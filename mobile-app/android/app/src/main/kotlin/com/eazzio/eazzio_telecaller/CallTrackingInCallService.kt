package com.eazzio.eazzio_telecaller

import android.content.Intent
import android.os.IBinder
import android.telecom.InCallService

class CallTrackingInCallService : InCallService() {
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
