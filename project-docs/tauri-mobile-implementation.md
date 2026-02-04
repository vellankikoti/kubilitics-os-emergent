# Kubilitics Mobile App Implementation Blueprint
## Tauri 2.0 - iOS & Android

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Platform:** Tauri 2.0 Mobile (iOS 13+, Android 8+)
**Languages:** Swift (iOS), Kotlin (Android), Rust (Core)

---

## Table of Contents

1. [Mobile Architecture Overview](#1-mobile-architecture-overview)
2. [Project Setup](#2-project-setup)
3. [Platform-Specific Configuration](#3-platform-specific-configuration)
4. [Native Features Integration](#4-native-features-integration)
5. [Mobile UI Adaptations](#5-mobile-ui-adaptations)
6. [Biometric Authentication](#6-biometric-authentication)
7. [Push Notifications](#7-push-notifications)
8. [Offline Mode & Data Sync](#8-offline-mode--data-sync)
9. [Build & Distribution](#9-build--distribution)
10. [App Store Submission](#10-app-store-submission)

---

## 1. Mobile Architecture Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  KUBILITICS MOBILE APP                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           NATIVE LAYER (iOS/Android)                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │  │
│  │  │   Swift    │  │  Kotlin    │  │  Native APIs │   │  │
│  │  │ (iOS only) │  │(Android)   │  │  (Biometric, │   │  │
│  │  │            │  │            │  │   Push, etc) │   │  │
│  │  └────────────┘  └────────────┘  └──────────────┘   │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │ (FFI/JNI)                           │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              TAURI CORE (Rust)                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │  │
│  │  │ Commands │  │  Events  │  │  State Management  │ │  │
│  │  └──────────┘  └──────────┘  └────────────────────┘ │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │ (IPC)                               │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              WEBVIEW (WKWebView/WebView)             │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │   React Application                            │  │  │
│  │  │   (Same as desktop, with mobile adaptations)   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │         LOCAL STORAGE (SQLite)                       │  │
│  │  - Offline cache                                     │  │
│  │  - User preferences                                  │  │
│  │  - Queued actions                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ (HTTP/WS)
                           ▼
               ┌────────────────────┐
               │  Kubilitics Backend│
               │  (Cloud or Local)  │
               └────────────────────┘
```

### 1.2 Platform Comparison

| Feature | iOS | Android | Implementation |
|---------|-----|---------|----------------|
| **Webview** | WKWebView | WebView | Tauri built-in |
| **Biometric** | FaceID/TouchID | Fingerprint | Tauri plugin |
| **Notifications** | APNs | FCM | Tauri plugin |
| **File Access** | Limited sandbox | Scoped storage | Tauri plugin |
| **Background Tasks** | Limited | Flexible | Native code |
| **Deep Links** | Universal Links | App Links | Tauri config |
| **In-App Purchase** | StoreKit | Play Billing | Custom plugin |

---

## 2. Project Setup

### 2.1 Initialize Tauri Mobile

```bash
# Install Tauri CLI
cargo install tauri-cli --version ^2.0.0-beta

# Initialize mobile platforms
cd kubilitics-frontend
cargo tauri android init
cargo tauri ios init

# Install mobile dependencies
cargo tauri android install-deps
cargo tauri ios install-deps
```

### 2.2 Directory Structure

```
kubilitics-mobile/
├── src/                          # React frontend (shared with desktop)
│   ├── app/
│   ├── components/
│   ├── screens/
│   └── main.tsx
│
├── src-tauri/                    # Tauri core (Rust)
│   ├── src/
│   │   ├── lib.rs               # Mobile entry point
│   │   ├── commands.rs          # Tauri commands
│   │   ├── mobile.rs            # Mobile-specific code
│   │   └── models.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── gen/                          # Generated platform code
│   ├── android/                 # Android project
│   │   ├── app/
│   │   │   ├── src/
│   │   │   │   └── main/
│   │   │   │       ├── java/
│   │   │   │       ├── kotlin/
│   │   │   │       ├── AndroidManifest.xml
│   │   │   │       └── res/
│   │   │   ├── build.gradle
│   │   │   └── proguard-rules.pro
│   │   ├── gradle/
│   │   ├── build.gradle
│   │   └── settings.gradle
│   │
│   └── apple/                   # iOS project
│       ├── Kubilitics/
│       │   ├── Kubilitics.swift
│       │   ├── Info.plist
│       │   └── Assets.xcassets/
│       ├── Kubilitics.xcodeproj/
│       └── Podfile
│
└── capacitor.config.ts          # Capacitor config (if used)
```

---

## 3. Platform-Specific Configuration

### 3.1 iOS Configuration

**Info.plist** (`gen/apple/Kubilitics/Info.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Kubilitics</string>

    <key>CFBundleIdentifier</key>
    <string>com.kubilitics.app</string>

    <key>CFBundleVersion</key>
    <string>1.0.0</string>

    <key>LSRequiresIPhoneOS</key>
    <true/>

    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>

    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>armv7</string>
    </array>

    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>

    <key>NSCameraUsageDescription</key>
    <string>To scan QR codes for cluster connection</string>

    <key>NSFaceIDUsageDescription</key>
    <string>Authenticate to access your clusters</string>

    <key>NSPhotoLibraryUsageDescription</key>
    <string>To save topology exports</string>

    <!-- Universal Links -->
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>kubilitics</string>
            </array>
        </dict>
    </array>

    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:kubilitics.com</string>
        <string>applinks:app.kubilitics.com</string>
    </array>
</dict>
</plist>
```

**Podfile** (iOS dependencies):

```ruby
platform :ios, '13.0'

target 'Kubilitics' do
  use_frameworks!

  # Tauri core
  pod 'Tauri', :path => '../..'

  # Additional pods
  pod 'SQLite.swift', '~> 0.14.0'
  pod 'KeychainSwift', '~> 20.0'
end
```

### 3.2 Android Configuration

**AndroidManifest.xml** (`gen/android/app/src/main/AndroidManifest.xml`):

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.kubilitics.app">

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:theme="@style/Theme.Kubilitics"
        android:allowBackup="true"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:theme="@style/Theme.Kubilitics.SplashScreen"
            android:exported="true"
            android:launchMode="singleTask"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:windowSoftInputMode="adjustResize">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Deep Links -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="kubilitics" />
                <data android:host="kubilitics.com" android:scheme="https" />
            </intent-filter>
        </activity>

        <!-- Firebase Messaging (for push notifications) -->
        <service
            android:name=".firebase.MessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

**build.gradle** (app-level):

```gradle
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'com.google.gms.google-services'  // Firebase
}

android {
    namespace 'com.kubilitics.app'
    compileSdk 34

    defaultConfig {
        applicationId "com.kubilitics.app"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.webkit:webkit:1.9.0'

    // Biometric
    implementation 'androidx.biometric:biometric:1.2.0-alpha05'

    // Firebase
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging-ktx'

    // SQLite
    implementation 'androidx.sqlite:sqlite-ktx:2.4.0'

    // Testing
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
```

---

## 4. Native Features Integration

### 4.1 Rust Mobile Commands

```rust
// src-tauri/src/mobile.rs
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BiometricResult {
    pub success: bool,
    pub error: Option<String>,
}

#[command]
pub async fn authenticate_biometric() -> Result<BiometricResult, String> {
    #[cfg(target_os = "ios")]
    {
        ios::authenticate_biometric().await
    }

    #[cfg(target_os = "android")]
    {
        android::authenticate_biometric().await
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        Err("Biometric auth not supported on this platform".into())
    }
}

#[command]
pub fn get_device_info() -> DeviceInfo {
    DeviceInfo {
        platform: std::env::consts::OS.to_string(),
        version: get_os_version(),
        model: get_device_model(),
    }
}

#[command]
pub async fn request_notification_permission() -> Result<bool, String> {
    #[cfg(target_os = "ios")]
    {
        ios::request_notification_permission().await
    }

    #[cfg(target_os = "android")]
    {
        android::request_notification_permission().await
    }
}

#[command]
pub fn vibrate(duration: u64) {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        mobile_haptics::vibrate(duration);
    }
}

#[command]
pub fn share_content(content: String, title: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        ios::share_sheet(content, title)
    }

    #[cfg(target_os = "android")]
    {
        android::share_intent(content, title)
    }
}
```

### 4.2 iOS Native Integration (Swift)

```swift
// gen/apple/Kubilitics/BiometricAuth.swift
import LocalAuthentication

@objc(BiometricAuth)
class BiometricAuth: NSObject {
    @objc static func authenticate(_ completion: @escaping (Bool, String?) -> Void) {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            let reason = "Authenticate to access your clusters"

            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
                DispatchQueue.main.async {
                    if success {
                        completion(true, nil)
                    } else {
                        completion(false, authError?.localizedDescription ?? "Authentication failed")
                    }
                }
            }
        } else {
            completion(false, error?.localizedDescription ?? "Biometric not available")
        }
    }
}
```

### 4.3 Android Native Integration (Kotlin)

```kotlin
// gen/android/app/src/main/kotlin/com/kubilitics/app/BiometricAuth.kt
package com.kubilitics.app

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricAuth(private val context: Context) {

    fun authenticate(
        activity: FragmentActivity,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(context)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onError("Authentication failed")
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Authenticate")
            .setSubtitle("Access your Kubernetes clusters")
            .setNegativeButtonText("Cancel")
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    fun isAvailable(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }
}
```

---

## 5. Mobile UI Adaptations

### 5.1 Responsive Design Utilities

```typescript
// src/lib/mobile.ts
import { invoke } from '@tauri-apps/api/core';

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function getDeviceOrientation(): 'portrait' | 'landscape' {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

export async function vibrate(duration: number = 50) {
  if (isMobile()) {
    await invoke('vibrate', { duration });
  }
}

export async function shareContent(content: string, title?: string) {
  if (isMobile()) {
    await invoke('share_content', { content, title });
  } else {
    // Fallback to clipboard
    await navigator.clipboard.writeText(content);
  }
}
```

### 5.2 Mobile-Optimized Components

```typescript
// src/components/mobile/MobileTopologyView.tsx
import { useGesture } from '@use-gesture/react';
import { animated, useSpring } from '@react-spring/web';

export function MobileTopologyView() {
  const [{ scale, x, y }, api] = useSpring(() => ({
    scale: 1,
    x: 0,
    y: 0,
  }));

  const bind = useGesture({
    onPinch: ({ offset: [s] }) => {
      api.start({ scale: Math.max(0.5, Math.min(3, s)) });
    },
    onDrag: ({ offset: [dx, dy], touches }) => {
      if (touches === 2) {
        api.start({ x: dx, y: dy });
      }
    },
  });

  return (
    <div className="relative h-full overflow-hidden" {...bind()}>
      <animated.div
        style={{
          transform: scale.to(s => `scale(${s}) translate(${x.get()}px, ${y.get()}px)`),
        }}
      >
        <TopologyCanvas />
      </animated.div>

      {/* Zoom Controls */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-2">
        <button
          onClick={() => api.start({ scale: scale.get() + 0.2 })}
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          <Plus className="h-6 w-6 mx-auto" />
        </button>
        <button
          onClick={() => api.start({ scale: scale.get() - 0.2 })}
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          <Minus className="h-6 w-6 mx-auto" />
        </button>
      </div>
    </div>
  );
}
```

### 5.3 Pull-to-Refresh

```typescript
// src/components/mobile/PullToRefresh.tsx
import { useState } from 'react';

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      const touch = e.touches[0];
      setPulling(true);
      // Track initial position
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pulling && window.scrollY === 0) {
      const touch = e.touches[0];
      const distance = touch.clientY - initialY;
      setPullDistance(Math.max(0, distance));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      await onRefresh();
      await vibrate(30);
    }
    setPulling(false);
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="flex justify-center items-center"
          style={{ height: pullDistance }}
        >
          <Loader2 className={cn(
            "h-6 w-6 text-primary",
            pullDistance > 80 && "animate-spin"
          )} />
        </div>
      )}
      {children}
    </div>
  );
}
```

---

## 6. Biometric Authentication

### 6.1 Frontend Integration

```typescript
// src/services/mobile/biometric.ts
import { invoke } from '@tauri-apps/api/core';

export async function authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await invoke<{ success: boolean; error?: string }>('authenticate_biometric');
    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await invoke<boolean>('is_biometric_available');
    return result;
  } catch {
    return false;
  }
}

// Usage in login screen
export function BiometricLogin() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setIsAvailable);
  }, []);

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometric();

    if (result.success) {
      toast.success('Authenticated successfully');
      // Proceed with login
    } else {
      toast.error(result.error || 'Authentication failed');
    }
  };

  if (!isAvailable) return null;

  return (
    <Button onClick={handleBiometricLogin} variant="outline" className="w-full">
      <Fingerprint className="mr-2 h-4 w-4" />
      Login with {isIOS() ? 'Face ID / Touch ID' : 'Fingerprint'}
    </Button>
  );
}
```

---

## 7. Push Notifications

### 7.1 iOS Push Notifications (APNs)

```swift
// gen/apple/Kubilitics/NotificationService.swift
import UserNotifications

class NotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationService()

    func requestPermission(completion: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, error in
            completion(granted)
        }
    }

    func registerForPushNotifications() {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    // Handle received notifications
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Handle deep link from notification
        if let deepLink = userInfo["deepLink"] as? String {
            // Navigate to specific screen
            NotificationCenter.default.post(
                name: .openDeepLink,
                object: nil,
                userInfo: ["url": deepLink]
            )
        }

        completionHandler()
    }
}
```

### 7.2 Android Push Notifications (FCM)

```kotlin
// gen/android/app/src/main/kotlin/com/kubilitics/app/firebase/MessagingService.kt
package com.kubilitics.app.firebase

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.kubilitics.app.MainActivity
import com.kubilitics.app.R

class MessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        remoteMessage.notification?.let {
            sendNotification(it.title ?: "", it.body ?: "", remoteMessage.data)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to server
        sendTokenToServer(token)
    }

    private fun sendNotification(title: String, body: String, data: Map<String, String>) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // Add deep link if present
            data["deepLink"]?.let {
                putExtra("deepLink", it)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "kubilitics_notifications"
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Kubilitics Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(0, notificationBuilder.build())
    }

    private fun sendTokenToServer(token: String) {
        // Send FCM token to backend
        // POST /api/v1/push/register { "token": token, "platform": "android" }
    }
}
```

### 7.3 Frontend Integration

```typescript
// src/services/mobile/notifications.ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('request_notification_permission');
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}

export async function registerForPushNotifications() {
  const granted = await requestNotificationPermission();

  if (granted) {
    // Get FCM/APNs token and send to backend
    const token = await invoke<string>('get_push_token');

    await fetch('/api/v1/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: isIOS() ? 'ios' : 'android',
      }),
    });
  }
}

// Listen for notification taps
export function setupNotificationHandlers() {
  listen<{ deepLink: string }>('notification-tap', (event) => {
    const { deepLink } = event.payload;
    // Navigate to deep link
    window.location.href = deepLink;
  });
}
```

---

## 8. Offline Mode & Data Sync

### 8.1 SQLite Local Storage

```rust
// src-tauri/src/mobile/storage.rs
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

pub struct LocalStorage {
    conn: Connection,
}

impl LocalStorage {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS cached_resources (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                namespace TEXT,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                cached_at INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS queued_actions (
                id TEXT PRIMARY KEY,
                action_type TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn cache_resource(&self, resource: &CachedResource) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO cached_resources (id, type, namespace, name, data, cached_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                resource.id,
                resource.resource_type,
                resource.namespace,
                resource.name,
                resource.data,
                resource.cached_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_cached_resource(&self, id: &str) -> Result<Option<CachedResource>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, type, namespace, name, data, cached_at FROM cached_resources WHERE id = ?1"
        )?;

        let resource = stmt.query_row([id], |row| {
            Ok(CachedResource {
                id: row.get(0)?,
                resource_type: row.get(1)?,
                namespace: row.get(2)?,
                name: row.get(3)?,
                data: row.get(4)?,
                cached_at: row.get(5)?,
            })
        });

        match resource {
            Ok(r) => Ok(Some(r)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn queue_action(&self, action: &QueuedAction) -> Result<()> {
        self.conn.execute(
            "INSERT INTO queued_actions (id, action_type, resource_type, data, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                action.id,
                action.action_type,
                action.resource_type,
                action.data,
                action.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_queued_actions(&self) -> Result<Vec<QueuedAction>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, action_type, resource_type, data, created_at FROM queued_actions"
        )?;

        let actions = stmt.query_map([], |row| {
            Ok(QueuedAction {
                id: row.get(0)?,
                action_type: row.get(1)?,
                resource_type: row.get(2)?,
                data: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        actions.collect()
    }
}
```

### 8.2 Sync Manager

```typescript
// src/services/mobile/sync.ts
export class SyncManager {
  private syncInterval: number = 30000; // 30 seconds
  private intervalId: NodeJS.Timeout | null = null;

  startAutoSync() {
    this.intervalId = setInterval(async () => {
      if (navigator.onLine) {
        await this.sync();
      }
    }, this.syncInterval);

    // Also sync when coming online
    window.addEventListener('online', () => this.sync());
  }

  stopAutoSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async sync() {
    try {
      // Get queued actions
      const actions = await invoke<QueuedAction[]>('get_queued_actions');

      // Execute each action
      for (const action of actions) {
        await this.executeAction(action);
        await invoke('remove_queued_action', { id: action.id });
      }

      // Fetch latest data
      await this.fetchLatestData();

      toast.success('Synced successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  private async executeAction(action: QueuedAction) {
    const { actionType, resourceType, data } = action;

    switch (actionType) {
      case 'create':
        await fetch(`/api/v1/${resourceType}`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        break;
      case 'update':
        await fetch(`/api/v1/${resourceType}/${data.namespace}/${data.name}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await fetch(`/api/v1/${resourceType}/${data.namespace}/${data.name}`, {
          method: 'DELETE',
        });
        break;
    }
  }

  private async fetchLatestData() {
    // Fetch and cache latest resources
    const resources = await fetch('/api/v1/resources').then(r => r.json());

    for (const resource of resources) {
      await invoke('cache_resource', { resource });
    }
  }
}

export const syncManager = new SyncManager();
```

---

## 9. Build & Distribution

### 9.1 iOS Build

```bash
# Development build
cargo tauri ios dev

# Production build
cargo tauri ios build --release

# Build for specific device
cargo tauri ios build --device "iPhone 15 Pro"

# Build archive for App Store
xcodebuild -workspace gen/apple/Kubilitics.xcworkspace \
  -scheme Kubilitics \
  -configuration Release \
  -archivePath build/Kubilitics.xcarchive \
  archive

# Export IPA
xcodebuild -exportArchive \
  -archivePath build/Kubilitics.xcarchive \
  -exportPath build \
  -exportOptionsPlist ExportOptions.plist
```

### 9.2 Android Build

```bash
# Development build
cargo tauri android dev

# Production APK
cargo tauri android build --release

# Production AAB (for Play Store)
cd gen/android
./gradlew bundleRelease

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore kubilitics.keystore \
  app-release-unsigned.apk \
  kubilitics

# Align APK
zipalign -v 4 app-release-unsigned.apk kubilitics-release.apk
```

---

## 10. App Store Submission

### 10.1 iOS App Store

**Steps:**
1. Create App Store Connect record
2. Configure app metadata, screenshots
3. Upload build via Xcode or `xcrun altool`
4. Submit for review
5. Wait for approval (1-3 days typical)

**Screenshots Required:**
- iPhone 6.7" (1290x2796)
- iPhone 6.5" (1242x2688)
- iPad Pro 12.9" (2048x2732)

### 10.2 Google Play Store

**Steps:**
1. Create Google Play Console account
2. Create app listing
3. Upload AAB bundle
4. Configure store listing, screenshots
5. Submit for review
6. Wait for approval (1-7 days)

**Screenshots Required:**
- Phone (1080x1920 min)
- 7-inch tablet (optional)
- 10-inch tablet (optional)

---

**(End of Mobile Implementation Blueprint)**

**Summary**: Comprehensive Tauri mobile implementation for iOS and Android with native features, offline support, push notifications, and App Store submission guides.
