import Foundation
import CoreTelephony
import Network

@objc(NetworkQoS)
final class NetworkQoSModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(getNetworkInfo:)
  func getNetworkInfo(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    var result: [String: Any] = ["type": "unknown"]
    let monitor = NWPathMonitor()
    let queue = DispatchQueue(label: "network-qos.info")
    monitor.pathUpdateHandler = { path in
      if path.usesInterfaceType(.wifi) { result["type"] = "wifi" }
      else if path.usesInterfaceType(.cellular) { result["type"] = "cellular" }
      else if path.usesInterfaceType(.wiredEthernet) { result["type"] = "ethernet" }
      monitor.cancel()
      DispatchQueue.main.async { resolve(result) }
    }
    monitor.start(queue: queue)
  }

  @objc(measureTcpProbes:port:count:resolve:reject:)
  func measureTcpProbes(hosts: [String], port: NSNumber, count: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .utility).async {
      let group = DispatchGroup()
      var output = [[String: Any]]()
      let lock = NSLock()
      for host in hosts {
        group.enter()
        self.probe(host: host, port: port.intValue, count: max(1, min(10, count.intValue))) { item in
          lock.lock(); output.append(item); lock.unlock(); group.leave()
        }
      }
      group.wait()
      resolve(output)
    }
  }

  private func probe(host: String, port: Int, count: Int, completion: @escaping ([String: Any]) -> Void) {
    var samples = [Double](); let group = DispatchGroup(); let lock = NSLock()
    for _ in 0..<count {
      group.enter(); let started = Date()
      let connection = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: UInt16(port))!, using: .tcp)
      connection.stateUpdateHandler = { state in
        if case .ready = state { lock.lock(); samples.append(Date().timeIntervalSince(started) * 1000); lock.unlock(); connection.cancel(); group.leave() }
        if case .failed = state { connection.cancel(); group.leave() }
      }
      connection.start(queue: .global(qos: .utility))
    }
    group.notify(queue: .global(qos: .utility)) {
      let sorted = samples.sorted(); let average = samples.isEmpty ? 0 : samples.reduce(0, +) / Double(samples.count)
      let jitter = samples.count < 2 ? 0 : zip(samples.dropFirst(), samples).map { abs($0 - $1) }.reduce(0, +) / Double(samples.count - 1)
      completion(["host": host, "min": sorted.first ?? 0, "avg": average, "max": sorted.last ?? 0, "jitter": jitter, "loss": Double(count - samples.count) / Double(count) * 100, "samples": samples])
    }
  }
}
