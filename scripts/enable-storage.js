/**
 * Firebase Storage'ı programatik olarak etkinleştirmek için yardımcı script
 * 
 * Kullanım:
 * 1. Google Cloud SDK yüklü olmalı (gcloud)
 * 2. gcloud auth login yapın
 * 3. node scripts/enable-storage.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// firebase/config.js'den project ID'yi oku
const configPath = path.join(__dirname, '..', 'firebase', 'config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

const projectIdMatch = configContent.match(/projectId:\s*["']([^"']+)["']/);
const projectId = projectIdMatch ? projectIdMatch[1] : null;

if (!projectId || projectId === 'YOUR_PROJECT_ID') {
  console.error('❌ Lütfen firebase/config.js dosyasında projectId\'yi doldurun!');
  process.exit(1);
}

console.log(`📦 Proje ID: ${projectId}`);
console.log('🔄 Storage API\'yi etkinleştiriliyor...');

try {
  // Storage API'yi etkinleştir
  execSync(
    `gcloud services enable storage-component.googleapis.com --project=${projectId}`,
    { stdio: 'inherit' }
  );
  
  console.log('✅ Storage API etkinleştirildi!');
  console.log('\n📝 Şimdi Google Cloud Console\'dan bucket oluşturmanız gerekiyor:');
  console.log(`   https://console.cloud.google.com/storage/browser?project=${projectId}`);
  console.log('\n   Bucket adı: ' + projectId + '.appspot.com');
  console.log('   Location: Size en yakın bölgeyi seçin (örn: europe-west1)');
  
} catch (error) {
  console.error('❌ Hata:', error.message);
  console.log('\n💡 Alternatif: Google Cloud Console\'dan manuel olarak etkinleştirin:');
  console.log('   1. https://console.cloud.google.com/apis/library/storage-component.googleapis.com');
  console.log(`   2. Proje: ${projectId}`);
  console.log('   3. "Enable" butonuna tıklayın');
}
