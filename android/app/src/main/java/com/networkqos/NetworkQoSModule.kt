package com.networkqos

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import kotlin.math.abs

/**
 * Puente nativo de telefonía y sondas TCP.
 * - getNetworkInfo: tipo de transporte, operador, generación celular (2G..5G NR), RSSI en dBm y nivel 0-4.
 * - measureTcpProbes: RTT = tiempo del handshake TCP (connect) medido con System.nanoTime en un pool
 *   de hilos propio, para no bloquear ni el hilo JS ni el de UI.
 */
class NetworkQoSModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor = Executors.newCachedThreadPool()

    override fun getName() = "NetworkQoS"

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    @ReactMethod
    fun getNetworkInfo(promise: Promise) {
        try {
            val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
            val result = WritableNativeMap()
            val type = when {
                capabilities == null -> "none"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "unknown"
            }
            result.putString("type", type)

            val telephony = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            telephony.networkOperatorName?.takeIf { it.isNotBlank() }?.let { result.putString("carrier", it) }

            if (type == "cellular") {
                cellularGeneration(telephony)?.let { result.putString("generation", it) }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    telephony.signalStrength?.let { strength ->
                        strength.cellSignalStrengths.firstOrNull()?.let { cell ->
                            if (cell.dbm != Int.MAX_VALUE) result.putInt("rssi", cell.dbm)
                        }
                        result.putInt("level", strength.level)
                    }
                }
            } else if (type == "wifi") {
                wifiInfo(capabilities, connectivity)?.let { info ->
                    if (info.rssi > -127) {
                        result.putInt("rssi", info.rssi)
                        result.putInt("level", wifiLevel(info.rssi))
                    }
                }
            }
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("NETWORK_INFO", error)
        }
    }

    /** dataNetworkType exige READ_PHONE_STATE desde Android 11; sin permiso se devuelve null y JS usa NetInfo. */
    @SuppressLint("MissingPermission")
    private fun cellularGeneration(telephony: TelephonyManager): String? {
        if (!granted(Manifest.permission.READ_PHONE_STATE)) return null
        val networkType = try { telephony.dataNetworkType } catch (_: SecurityException) { return null }
        return when (networkType) {
            TelephonyManager.NETWORK_TYPE_NR -> "5G NR"
            TelephonyManager.NETWORK_TYPE_LTE -> "4G LTE"
            TelephonyManager.NETWORK_TYPE_HSPAP, TelephonyManager.NETWORK_TYPE_HSPA, TelephonyManager.NETWORK_TYPE_HSDPA,
            TelephonyManager.NETWORK_TYPE_HSUPA, TelephonyManager.NETWORK_TYPE_UMTS, TelephonyManager.NETWORK_TYPE_EVDO_0,
            TelephonyManager.NETWORK_TYPE_EVDO_A, TelephonyManager.NETWORK_TYPE_EVDO_B, TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "3G"
            TelephonyManager.NETWORK_TYPE_EDGE, TelephonyManager.NETWORK_TYPE_GPRS, TelephonyManager.NETWORK_TYPE_CDMA,
            TelephonyManager.NETWORK_TYPE_1xRTT, TelephonyManager.NETWORK_TYPE_GSM -> "2G"
            else -> null
        }
    }

    @Suppress("DEPRECATION")
    private fun wifiInfo(capabilities: NetworkCapabilities?, connectivity: ConnectivityManager): WifiInfo? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            (capabilities?.transportInfo as? WifiInfo)?.let { return it }
        }
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        return wifi.connectionInfo
    }

    private fun wifiLevel(rssi: Int) = when {
        rssi >= -55 -> 4
        rssi >= -66 -> 3
        rssi >= -77 -> 2
        rssi >= -88 -> 1
        else -> 0
    }

    @ReactMethod
    fun measureTcpProbes(hosts: ReadableArray, port: Int, count: Int, promise: Promise) {
        val total = count.coerceIn(1, 10)
        val hostList = (0 until hosts.size()).mapNotNull { hosts.getString(it) }
        executor.execute {
            try {
                // Cada host en paralelo; dentro de un host las sondas van en serie para medir jitter.
                val futures = hostList.map { host -> executor.submit(Callable { probeHost(host, port, total) }) }
                val result = WritableNativeArray()
                futures.forEach { result.pushMap(it.get()) }
                promise.resolve(result)
            } catch (error: Exception) {
                promise.reject("TCP_PROBE", error)
            }
        }
    }

    private fun probeHost(host: String, port: Int, total: Int): WritableNativeMap {
        val samples = mutableListOf<Double>()
        repeat(total) {
            try {
                // Resolver DNS antes de medir para que el RTT sea solo el handshake TCP.
                val address = InetSocketAddress(host, port)
                Socket().use { socket ->
                    socket.tcpNoDelay = true
                    val started = System.nanoTime()
                    socket.connect(address, 3000)
                    samples.add((System.nanoTime() - started) / 1_000_000.0)
                }
            } catch (_: Exception) {
                // Timeout o rechazo: cuenta como paquete perdido.
            }
            Thread.sleep(120)
        }
        val map = WritableNativeMap()
        map.putString("host", host)
        val sampleArray = WritableNativeArray()
        samples.forEach { sampleArray.pushDouble(round2(it)) }
        if (samples.isEmpty()) {
            map.putDouble("min", 0.0); map.putDouble("avg", 0.0); map.putDouble("max", 0.0)
            map.putDouble("jitter", 0.0); map.putDouble("loss", 100.0)
        } else {
            val jitter = if (samples.size < 2) 0.0 else samples.zipWithNext { a, b -> abs(b - a) }.average()
            map.putDouble("min", round2(samples.min()))
            map.putDouble("avg", round2(samples.average()))
            map.putDouble("max", round2(samples.max()))
            map.putDouble("jitter", round2(jitter))
            map.putDouble("loss", round2((total - samples.size) * 100.0 / total))
        }
        map.putArray("samples", sampleArray)
        return map
    }

    private fun round2(value: Double) = Math.round(value * 100.0) / 100.0

    override fun invalidate() {
        executor.shutdownNow()
        super.invalidate()
    }
}
