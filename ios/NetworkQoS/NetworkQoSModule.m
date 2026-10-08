#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NetworkQoS, NSObject)
RCT_EXTERN_METHOD(getNetworkInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(measureTcpProbes:(NSArray *)hosts port:(nonnull NSNumber *)port count:(nonnull NSNumber *)count resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
@end
