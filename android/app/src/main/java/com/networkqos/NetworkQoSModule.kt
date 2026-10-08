package com.networkqos

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Executors
import kotlin.math.abs

class NetworkQoSModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor = Executors.newCachedThreadPool()

    override fun getName() = "NetworkQoS"

    @ReactMethod
    fun getNetworkInfo(promise: Promise) {
        try {
            val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = connectivity.activeNetwork
            val capabilities = connectivity.getNetworkCapabilities(network)
            val result = WritableNativeMap()
            result.putString("type", when {
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "wifi"
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "cellular"
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "ethernet"
                else -> "unknown"
            })
            val telephony = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            telephony.networkOperatorName?.takeIf { it.isNotBlank() }?.let { result.putString("carrier", it) }
            val generation = when (telephony.dataNetworkType) {
                TelephonyManager.NETWORK_TYPE_NR -> "5G NR"
                TelephonyManager.NETWORK_TYPE_LTE -> "4G LTE"
                TelephonyManager.NETWORK_TYPE_HSPAP, TelephonyManager.NETWORK_TYPE_HSPA, TelephonyManager.NETWORK_TYPE_UMTS -> "3G"
                else -> null
            }
            generation?.let { result.putString("generation", it) }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                telephony.signalStrength?.cellSignalStrengths?.firstOrNull()?.dbm?.let { result.putInt("rssi", it) }
            }
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("NETWORK_INFO", error)
        }
    }

    @ReactMethod
    fun measureTcpProbes(hosts: ReadableArray, port: Int, count: Int, promise: Promise) {
        executor.execute {
            try {
                val result = WritableNativeArray()
                for (hostIndex in 0 until hosts.size()) {
                    val host = hosts.getString(hostIndex) ?: continue
                    val samples = mutableListOf<Double>()
                    repeat(count.coerceIn(1, 10)) {
                        val started = System.nanoTime()
                        try {
                            Socket().use { socket ->
                                socket.connect(InetSocketAddress(host, port), 4000)
                                samples.add((System.nanoTime() - started) / 1_000_000.0)
                            }
                        } catch (_: Exception) { }
                    }
                    val map = WritableNativeMap()
                    map.putString("host", host)
                    if (samples.isEmpty()) {
                        map.putDouble("min", 0.0); map.putDouble("avg", 0.0); map.putDouble("max", 0.0); map.putDouble("jitter", 0.0); map.putDouble("loss", 100.0)
                    } else {
                        val min = samples.minOrNull() ?: 0.0
                        val max = samples.maxOrNull() ?: 0.0
                        val avg = samples.average()
                        val jitter = if (samples.size < 2) 0.0 else samples.zipWithNext().map { abs(it.second - it.first) }.average()
                        map.putDouble("min", min); map.putDouble("avg", avg); map.putDouble("max", max); map.putDouble("jitter", jitter); map.putDouble("loss", ((count - samples.size).toDouble() / count) * 100)
                    }
                    val sampleArray = WritableNativeArray(); samples.forEach { sampleArray.pushDouble(it) }; map.putArray("samples", sampleArray)
                    result.pushMap(map)
                }
                promise.resolve(result)
            } catch (error: Exception) { promise.reject("TCP_PROBE", error) }
        }
    }
}
