# Firebase Package Name Bilgileri

## 📱 Package Name (Bundle Identifier)

### Android:
```
com.notlan.app
```

### iOS:
```
com.notlan.app
```

## 🔍 Firebase Console'da Proje ID'sini Bulma

### Yöntem 1: Firebase Console'dan
1. [Firebase Console](https://console.firebase.google.com/) açın
2. Projenizi seçin
3. Sol üst köşedeki **⚙️ (Settings)** ikonuna tıklayın
4. **"Project settings"** seçin
5. **"General"** sekmesinde **"Project ID"** görünecek

### Yöntem 2: firebase/config.js'den
`firebase/config.js` dosyasındaki `projectId` değeri Firebase proje ID'nizdir.

### Yöntem 3: Firebase Console URL'den
Firebase Console URL'iniz şu formattadır:
```
https://console.firebase.google.com/project/YOUR_PROJECT_ID/...
```
URL'deki `YOUR_PROJECT_ID` kısmı proje ID'nizdir.

## 📝 Firebase'de App Ekleme

Firebase Console'da uygulama eklerken:

### Android App:
- **Package name:** `com.notlan.app`
- **App nickname (opsiyonel):** Not-Lan Android

### iOS App:
- **Bundle ID:** `com.notlan.app`
- **App nickname (opsiyonel):** Not-Lan iOS

### Web App:
- **App nickname:** Not-Lan Web

## ⚙️ app.json Ayarları

Package name'ler `app.json` dosyasında şu şekilde tanımlı:

```json
{
  "expo": {
    "android": {
      "package": "com.notlan.app"
    },
    "ios": {
      "bundleIdentifier": "com.notlan.app"
    }
  }
}
```

## 🔄 Package Name Değiştirme

Eğer farklı bir package name kullanmak isterseniz:

1. `app.json` dosyasını düzenleyin
2. Android: `android.package` değerini değiştirin
3. iOS: `ios.bundleIdentifier` değerini değiştirin
4. Firebase Console'da yeni package name ile uygulama ekleyin

**Not:** Package name değiştirdikten sonra Firebase'de yeni bir uygulama oluşturmanız gerekebilir.

