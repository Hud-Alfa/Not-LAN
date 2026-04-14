# Not-Lan - Öğrenci Not Paylaşım Platformu

Modern, sade ve kullanıcı dostu bir öğrenci not paylaşım uygulaması. Hem web hem de Android için uyumlu.

## Özellikler

- 🔐 Kullanıcı girişi ve kayıt sistemi
- 📝 Not paylaşma ve görüntüleme
- 💬 Gerçek zamanlı mesajlaşma
- 👤 Profil yönetimi
- ⭐ Beğeni ve güven sistemi
- 💬 Yorum sistemi
- 🔍 Kategori filtreleme ve arama
- 📱 Responsive tasarım (Web + Android)

## Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

### 2. Firebase Yapılandırması

1. [Firebase Console](https://console.firebase.google.com/) üzerinden yeni bir proje oluşturun
2. Authentication'ı etkinleştirin (Email/Password)
3. Firestore Database'i oluşturun
4. **Storage'ı etkinleştirin** (Detaylar için `FIREBASE_SETUP.md` dosyasına bakın)
5. Proje kökünde `.env.example` dosyasını `.env` olarak kopyalayın; `EXPO_PUBLIC_FIREBASE_*` değişkenlerini Firebase Console uygulama ayarlarından doldurun. Değerler `firebase/config.js` içinde ortam değişkeninden okunur. Özet: depo kökündeki `README.md`.

**⚠️ ÖNEMLİ: Storage Console'da açılmıyorsa:**
- Firebase CLI ile etkinleştirin: `firebase init storage`
- Veya `FIREBASE_SETUP.md` dosyasındaki alternatif yöntemleri deneyin

### 3. Firestore Kuralları

Firestore Database'iniz için aşağıdaki güvenlik kurallarını ayarlayın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kullanıcılar
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Notlar
    match /notes/{noteId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Yorumlar
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Beğeniler - beğenen kişi veya not sahibi silebilir
    match /likes/{likeId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Güvenler - güvenen kişi veya not sahibi silebilir
    match /trusts/{trustId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Sohbetler
    match /chats/{chatId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid in resource.data.participants;
    }
    
    // Mesajlar
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    
    // Şikayetler
    match /reports/{reportId} {
      allow create: if request.auth != null;
    }
  }
}
```

### 4. Storage Kuralları

Firebase Storage için aşağıdaki kuralları ayarlayın:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /notes/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /profileImages/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Çalıştırma

### Web için:
```bash
npm run web
```

### Android için:
```bash
npm run android
```

### iOS için:
```bash
npm run ios
```

## Proje Yapısı

```
not-lan/
├── App.js                 # Ana uygulama ve navigasyon
├── firebase/
│   └── config.js         # Firebase yapılandırması
├── screens/              # Tüm ekranlar
│   ├── LoginScreen.js
│   ├── RegisterScreen.js
│   ├── HomeScreen.js
│   ├── NoteDetailScreen.js
│   ├── UploadNoteScreen.js
│   ├── ChatListScreen.js
│   ├── NewChatScreen.js
│   ├── ChatScreen.js
│   ├── ProfileScreen.js
│   ├── SettingsScreen.js
│   └── EditProfileScreen.js
├── components/            # Yeniden kullanılabilir bileşenler
│   ├── CustomButton.js
│   └── CustomInput.js
└── constants/            # Sabitler
    ├── Colors.js
    └── Styles.js
```

## Tasarım Sistemi

- **Renk Paleti**: Mavi tonları (#2563EB), gri arkaplanlar (#F3F4F6), beyaz yüzeyler (#FFFFFF)
- **Tipografi**: Modern, okunabilir fontlar
- **Spacing**: Tutarlı padding ve margin değerleri
- **Köşeler**: Yuvarlatılmış köşeler (12-16px)
- **Gölgeler**: Yumuşak gölgeler

## Özellikler Detayı

### Giriş ve Kayıt
- E-posta/şifre ile giriş
- Şifre sıfırlama
- Kullanıcı kaydı (isim, soyisim, nickname, okul, bölüm, sınıf)

### Ana Sayfa
- Not kartları listesi
- Kategori filtreleme
- Arama özelliği
- Pull-to-refresh

### Not Detay
- Not içeriği görüntüleme
- Dosya indirme/görüntüleme
- Beğeni ve güven butonları
- Yorum sistemi

### Not Yükleme
- Başlık ve açıklama
- Kategori seçimi
- Dosya yükleme (PDF, görsel)
- Yükleme ilerlemesi

### Mesajlaşma
- Bireysel ve grup sohbetleri
- Gerçek zamanlı mesajlaşma
- Kullanıcı arama

### Profil
- Kullanıcı bilgileri
- Paylaşılan notlar
- Güven puanı
- Ayarlar

## Lisans

Bu proje açık kaynak kodludur.

