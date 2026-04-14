# Firebase Storage Kurulum Rehberi

Firebase Console'da Storage açılamıyorsa, aşağıdaki yöntemleri deneyin:

## Yöntem 1: Firebase CLI ile Storage Etkinleştirme (Önerilen)

### 1. Firebase CLI'yi yükleyin (eğer yüklü değilse):
```bash
npm install -g firebase-tools
```

### 2. Firebase'e giriş yapın:
```bash
firebase login
```

### 3. Projenizi başlatın:
```bash
firebase init storage
```

Bu komut sırasında:
- Mevcut Firebase projenizi seçin
- Storage location seçin (örn: `europe-west1` veya size en yakın bölge)
- Storage kuralları dosyası oluşturulacak

### 4. Storage'ı etkinleştirin:
```bash
firebase deploy --only storage
```

## Yöntem 2: Firebase Console'da Manuel Etkinleştirme

1. [Firebase Console](https://console.firebase.google.com/) açın
2. Projenizi seçin
3. Sol menüden **"Build"** > **"Storage"** seçeneğine tıklayın
4. Eğer "Get started" butonu görünüyorsa, ona tıklayın
5. Storage location seçin ve "Done" butonuna tıklayın

### Sorun Giderme:

**"Bilinmeyen hata" alıyorsanız:**

1. **Farklı tarayıcı deneyin**: Chrome, Firefox, Edge
2. **Gizli modda açın**: Ctrl+Shift+N (Chrome) veya Ctrl+Shift+P (Firefox)
3. **Cache temizleyin**: Ctrl+Shift+Delete
4. **VPN kapatın**: VPN bazen Firebase Console'a erişimi engelleyebilir
5. **Farklı ağ deneyin**: Mobil hotspot veya farklı internet bağlantısı

## Yöntem 3: REST API ile Storage Etkinleştirme

Eğer yukarıdaki yöntemler çalışmazsa, REST API kullanabilirsiniz:

```bash
# Proje ID'nizi alın (firebase/config.js'den)
PROJECT_ID="YOUR_PROJECT_ID"

# Storage'ı etkinleştir
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/-/buckets" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "europe-west1"
  }'
```

## Yöntem 4: Google Cloud Console'dan Etkinleştirme

1. [Google Cloud Console](https://console.cloud.google.com/) açın
2. Firebase projenizi seçin
3. Sol menüden **"Cloud Storage"** > **"Buckets"** seçin
4. **"Create Bucket"** butonuna tıklayın
5. Bucket adı: `YOUR_PROJECT_ID.appspot.com` (otomatik önerilir)
6. Location seçin ve oluşturun

## Storage Kurallarını Ayarlama

Storage etkinleştirildikten sonra, Firebase Console'da veya `storage.rules` dosyasında şu kuralları ayarlayın:

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

## Test Etme

Storage'ın çalıştığını test etmek için:

```javascript
// Test kodu
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase/config';

const testStorage = async () => {
  try {
    const testRef = ref(storage, 'test/test.txt');
    const blob = new Blob(['Test'], { type: 'text/plain' });
    await uploadBytes(testRef, blob);
    const url = await getDownloadURL(testRef);
    console.log('Storage çalışıyor!', url);
  } catch (error) {
    console.error('Storage hatası:', error);
  }
};
```

## Hala Sorun mu Var?

1. Firebase projenizin **Blaze (Ücretli) planında** olduğundan emin olun (Storage ücretsiz kotası var ama bazı özellikler için gerekli)
2. Firebase Support'a başvurun: [Firebase Support](https://firebase.google.com/support)
3. Geçici olarak, dosya yükleme özelliğini devre dışı bırakıp sadece metin notları paylaşabilirsiniz

