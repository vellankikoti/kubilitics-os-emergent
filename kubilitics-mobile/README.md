# Kubilitics Mobile

Mobile application for Kubilitics - iOS & Android

## Architecture

- **Frontend**: React (shared with web/desktop)
- **Mobile Shell**: Tauri Mobile (Rust + Native)
- **Backend**: Connects to remote Kubilitics backend

## Development

### Prerequisites

- Node.js 20+
- Rust 1.75+
- **iOS**: Xcode 15+, CocoaPods
- **Android**: Android Studio, Android SDK 26+

### Setup

```bash
# Install Tauri CLI
cargo install tauri-cli --version ^2.0

# Initialize mobile platforms
cargo tauri android init
cargo tauri ios init

# Install dependencies
npm install
```

### Run on iOS

```bash
# Development
cargo tauri ios dev

# Or open in Xcode
open gen/apple/Kubilitics.xcodeproj
```

### Run on Android

```bash
# Development
cargo tauri android dev

# Or open in Android Studio
# File -> Open -> gen/android
```

## Features

- **Remote Backend**: Connects to Kubilitics backend (cluster-local or cloud)
- **Offline Mode**: Caches data for offline viewing
- **Biometric Auth**: Face ID / Touch ID / Fingerprint
- **Push Notifications**: Alerts for cluster events
- **Touch UI**: Mobile-optimized interface
- **QR Code**: Connect by scanning cluster QR code

## Building

### iOS

```bash
# Build for device
cargo tauri ios build --release

# Archive for App Store
xcodebuild -workspace gen/apple/Kubilitics.xcworkspace \
  -scheme Kubilitics \
  -configuration Release \
  -archivePath build/Kubilitics.xcarchive \
  archive
```

### Android

```bash
# Build APK
cargo tauri android build --release

# Build AAB for Play Store
cd gen/android
./gradlew bundleRelease
```

## Distribution

### iOS App Store

1. Create App Store Connect record
2. Upload build via Xcode or Transporter
3. Submit for review

### Google Play Store

1. Create Play Console listing
2. Upload AAB bundle
3. Submit for review

## Mobile-Specific Features

### Offline Sync

```rust
// Cache topology data locally
#[command]
async fn cache_topology(data: String) -> Result<(), String> {
    // Store in SQLite
}
```

### Biometric Authentication

```swift
// iOS: LocalAuthentication framework
import LocalAuthentication

func authenticateUser(completion: @escaping (Bool) -> Void) {
    let context = LAContext()
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                         localizedReason: "Access your clusters") { success, error in
        completion(success)
    }
}
```

### Push Notifications

```kotlin
// Android: Firebase Cloud Messaging
class MessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        // Handle notification
    }
}
```
