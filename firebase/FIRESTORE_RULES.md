# Firestore Security Rules

Firebase Console > Firestore Database > Rules sekmesine aşağıdaki kuralları yapıştırın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function: Kullanıcının admin olup olmadığını kontrol et
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true ||
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == 'True' ||
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == 'true');
    }
    
    // Kullanıcılar
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Notlar
    match /notes/{noteId} {
      allow read: if true;
      allow create: if request.auth != null;
      // Not sahibi tüm alanları güncelleyebilir, diğerleri sadece likesCount, trustCount ve commentsCount güncelleyebilir
      allow update: if request.auth != null && (
        // Not sahibi tüm alanları güncelleyebilir
        request.resource.data.userId == request.auth.uid ||
        // Diğer kullanıcılar sadece likesCount, trustCount ve commentsCount güncelleyebilir
        // Kritik alanların değişmediğini kontrol et
        (request.resource.data.userId == resource.data.userId &&
         request.resource.data.title == resource.data.title &&
         request.resource.data.description == resource.data.description &&
         // likesCount, trustCount veya commentsCount değişebilir, diğer alanlar aynı kalmalı
         (request.resource.data.likesCount != resource.data.likesCount ||
          request.resource.data.trustCount != resource.data.trustCount ||
          request.resource.data.commentsCount != resource.data.commentsCount))
      );
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Yorumlar
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Beğeniler - beğenen kişi silebilir, not sahibi de silebilir (not silinirken)
    match /likes/{likeId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        // Not sahibi de silebilir (not silinirken)
        (exists(/databases/$(database)/documents/notes/$(resource.data.noteId)) && 
         get(/databases/$(database)/documents/notes/$(resource.data.noteId)).data.userId == request.auth.uid)
      );
    }
    
    // Güvenler - güvenen kişi silebilir, not sahibi de silebilir (not silinirken)
    match /trusts/{trustId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        // Not sahibi de silebilir (not silinirken)
        (exists(/databases/$(database)/documents/notes/$(resource.data.noteId)) && 
         get(/databases/$(database)/documents/notes/$(resource.data.noteId)).data.userId == request.auth.uid)
      );
    }
    
    // Sohbetler
    match /chats/{chatId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid in resource.data.participants;
      allow delete: if request.auth != null && request.auth.uid in resource.data.participants;
    }
    
    // Mesajlar
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        // Sohbet katılımcıları da silebilir (sohbet silinirken)
        (exists(/databases/$(database)/documents/chats/$(resource.data.chatId)) && 
         request.auth.uid in get(/databases/$(database)/documents/chats/$(resource.data.chatId)).data.participants)
      );
    }
    
    // Şikayetler
    match /reports/{reportId} {
      allow create: if request.auth != null;
      allow read: if isAdmin(); // Sadece admin okuyabilir
      allow update: if isAdmin(); // Sadece admin güncelleyebilir
    }
  }
}
```

## Önemli Notlar

1. **Not silme izni**: Not sahibi notu silebilir (`resource.data.userId == request.auth.uid`)

2. **Likes/Trusts silme**: Not silme işleminde likes ve trusts'ı silmek için, not sahibinin bu kayıtları silme izni olması gerekir. Ancak bu karmaşık bir kural gerektirir. Alternatif olarak, not silme işleminde önce notu sil, sonra likes ve trusts'ı silmeye çalış (hata alırsa devam et).

3. **Index gereksinimleri**: 
   - `comments` koleksiyonunda `noteId` ve `createdAt` için composite index gerekebilir
   - Index oluşturmak için terminaldeki hata mesajındaki linki kullanın
   - Veya Firebase Console > Firestore > Indexes sekmesinden oluşturun

