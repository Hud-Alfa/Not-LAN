import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { storage, db, auth } from '../firebase/config';
import { isAdmin } from '../utils/admin';

const UploadNoteScreen = ({ navigation, route }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [targetSchoolType, setTargetSchoolType] = useState(''); // 'lise', 'üniversite', 'ortaokul', ''
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const admin = await isAdmin();
      setUserIsAdmin(admin);
    };
    checkAdminStatus();
  }, []);

  const categories = [
    { id: 'matematik&fen', name: 'Matematik & Fen', emoji: '🔬' },
    { id: 'sosyal bilimler', name: 'Sosyal Bilimler', emoji: '📚' },
    { id: 'teknoloji', name: 'Teknoloji', emoji: '💻' },
    { id: 'sanat&tasarım', name: 'Sanat & Tasarım', emoji: '🎨' },
    { id: 'dil&edebiyat', name: 'Dil & Edebiyat', emoji: '📖' },
    { id: 'iş&ekonomi', name: 'İş & Ekonomi', emoji: '💼' },
    { id: 'sağlık&tıp', name: 'Sağlık & Tıp', emoji: '🏥' },
    { id: 'hukuk', name: 'Hukuk', emoji: '⚖️' },
    { id: 'mühendislik', name: 'Mühendislik', emoji: '⚙️' },
    { id: 'mimarlık', name: 'Mimarlık', emoji: '🏠' },
    { id: 'diğer', name: 'Diğer', emoji: '📝' },
  ];

  const handleCategoryToggle = (categoryId) => {
    if (categoryId === 'diğer') {
      // "Diğer" seçildiğinde
      if (selectedCategories.includes('diğer')) {
        // "Diğer" zaten seçiliyse kaldır
        setSelectedCategories([]);
      } else {
        // "Diğer" seçiliyse sadece "Diğer"i ekle, diğerlerini temizle
        setSelectedCategories(['diğer']);
      }
    } else {
      // "Diğer" dışında bir kategori seçildiğinde
      if (selectedCategories.includes('diğer')) {
        // Eğer "Diğer" seçiliyse, "Diğer"i kaldır ve yeni kategoriyi ekle
        const newCategories = selectedCategories.filter(id => id !== 'diğer');
        if (newCategories.includes(categoryId)) {
          setSelectedCategories(newCategories.filter(id => id !== categoryId));
        } else {
          setSelectedCategories([...newCategories, categoryId]);
        }
      } else if (selectedCategories.includes(categoryId)) {
        // Kategori zaten seçiliyse kaldır
        setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
      } else {
        // Yeni kategori ekle (max 3)
        if (selectedCategories.length < 3) {
          setSelectedCategories([...selectedCategories, categoryId]);
        } else {
          Alert.alert('Uyarı', 'En fazla 3 kategori seçebilirsiniz');
        }
      }
    }
  };

  const pickDocument = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web için HTML input file kullan
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf,image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.onchange = (e) => {
          const selectedFile = e.target.files[0];
          if (selectedFile) {
            const fileSizeMB = selectedFile.size / 1024 / 1024;
            
            // 25 MB kontrolü
            if (fileSizeMB > 25) {
              if (Platform.OS === 'web') {
                window.alert('Dosya boyutu 25 MB\'dan büyük olamaz');
              } else {
                Alert.alert('Hata', 'Dosya boyutu 25 MB\'dan büyük olamaz');
              }
              document.body.removeChild(input);
              return;
            }
            
            // Web için file objesi oluştur
            const fileObj = {
              name: selectedFile.name,
              size: selectedFile.size,
              type: selectedFile.type,
              uri: URL.createObjectURL(selectedFile),
              file: selectedFile, // Web için File objesini sakla
            };
            
            setFile(fileObj);
          }
          document.body.removeChild(input);
        };
        
        input.click();
      } else {
        // Mobil için expo-document-picker kullan
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const selectedFile = result.assets[0];
          const fileSizeMB = selectedFile.size / 1024 / 1024;
          
          // 25 MB kontrolü
          if (fileSizeMB > 25) {
            Alert.alert('Hata', 'Dosya boyutu 25 MB\'dan büyük olamaz');
            return;
          }
          
          setFile(selectedFile);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      if (Platform.OS === 'web') {
        window.alert('Dosya seçilirken bir hata oluştu');
      } else {
        Alert.alert('Hata', 'Dosya seçilirken bir hata oluştu');
      }
    }
  };

  const handleUpload = async () => {
    if (userIsAdmin) {
      if (Platform.OS === 'web') {
        window.alert('Admin hesapları not paylaşamaz');
      } else {
        Alert.alert('Yetki Yok', 'Admin hesapları not paylaşamaz');
      }
      return;
    }

    if (!title.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen not başlığını girin');
      } else {
        Alert.alert('Hata', 'Lütfen not başlığını girin');
      }
      return;
    }

    if (selectedCategories.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Lütfen en az bir kategori seçin');
      } else {
        Alert.alert('Hata', 'Lütfen en az bir kategori seçin');
      }
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      if (Platform.OS === 'web') {
        window.alert('Giriş yapmanız gerekiyor');
      } else {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
      }
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Kullanıcı bilgilerini al
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : {};

      let fileUrl = null;
      let filePath = null;
      let fileName = null;

      // Dosya varsa yükle
      if (file) {
        fileName = `${userId}_${Date.now()}_${file.name}`;
        const fileRef = ref(storage, `notes/${fileName}`);

        // Dosyayı blob'a çevir
        let blob;
        if (Platform.OS === 'web' && file.file) {
          // Web'de File objesi varsa direkt kullan
          blob = file.file;
        } else {
          // Mobilde URI'den blob oluştur
          const response = await fetch(file.uri);
          blob = await response.blob();
        }

        const uploadTask = uploadBytesResumable(fileRef, blob);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Upload error:', error);
              reject(error);
            },
            async () => {
              try {
                fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
                filePath = `notes/${fileName}`;
                fileName = file.name;
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          );
        });
      }

      // Firestore'a not bilgilerini kaydet
      await addDoc(collection(db, 'notes'), {
        title: title.trim(),
        description: description.trim() || '',
        categories: selectedCategories,
        targetSchoolType: targetSchoolType || null, // Hangi okul türüne yönelik
        fileName: fileName || null,
        filePath: filePath || null,
        fileUrl: fileUrl || null,
        userId,
        userInfo: {
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          nickname: userData.nickname || '',
          department: userData.department || '',
          class: userData.class || '',
          schoolType: userData.schoolType || '', // Kullanıcının okul türü (geriye dönük uyumluluk için)
        },
        likesCount: 0,
        trustCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      });

      if (Platform.OS === 'web') {
        window.alert('Not başarıyla paylaşıldı');
        setTitle('');
        setDescription('');
        setSelectedCategories([]);
        setTargetSchoolType('');
        setFile(null);
        navigation.navigate('Home');
      } else {
        Alert.alert('Başarılı', 'Not başarıyla paylaşıldı', [
          {
            text: 'Tamam',
            onPress: () => {
              setTitle('');
              setDescription('');
              setSelectedCategories([]);
              setTargetSchoolType('');
              setFile(null);
              navigation.navigate('Home');
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error uploading:', error);
      if (Platform.OS === 'web') {
        window.alert('Not yüklenirken bir hata oluştu: ' + error.message);
      } else {
        Alert.alert('Hata', 'Not yüklenirken bir hata oluştu: ' + error.message);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Not Paylaş</Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            label="Başlık *"
            value={title}
            onChangeText={setTitle}
            placeholder="Not başlığını girin"
            autoCapitalize="sentences"
          />

          <CustomInput
            label="Açıklama"
            value={description}
            onChangeText={setDescription}
            placeholder="Not hakkında açıklama yazın (opsiyonel)"
            multiline
            numberOfLines={4}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Ders / Kategori * {selectedCategories.length > 0 && `(${selectedCategories.length}/3)`}
            </Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    cat.id === 'mimarlık' && styles.categoryChipWide,
                    selectedCategories.includes(cat.id) && styles.categoryChipActive,
                  ]}
                  onPress={() => handleCategoryToggle(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategories.includes(cat.id) && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Hedef Kitle (Opsiyonel)</Text>
            <View style={styles.schoolTypeContainer}>
              {['Lise', 'Üniversite', 'Ortaokul', 'Tümü'].map((type) => {
                const typeValue = type === 'Tümü' ? '' : type.toLowerCase();
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.schoolTypeButton,
                      targetSchoolType === typeValue && styles.schoolTypeButtonActive,
                    ]}
                    onPress={() => setTargetSchoolType(typeValue)}
                  >
                    <Text
                      style={[
                        styles.schoolTypeText,
                        targetSchoolType === typeValue && styles.schoolTypeTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Dosya (Opsiyonel)</Text>
            <TouchableOpacity
              style={styles.filePicker}
              onPress={pickDocument}
              disabled={uploading}
            >
              <Ionicons
                name={file ? "document" : "document-outline"}
                size={32}
                color={file ? Colors.primary : Colors.textSecondary}
              />
              <View style={styles.fileInfo}>
                {file ? (
                  <>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </>
                ) : (
                  <Text style={styles.filePlaceholder}>Dosya seçin (PDF veya Görsel)</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.fileLimitText}>Maksimum dosya boyutu: 25 MB</Text>
          </View>

          {uploading && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Yükleniyor... %{Math.round(uploadProgress)}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${uploadProgress}%` }]}
                />
              </View>
            </View>
          )}

          <CustomButton
            title="Not Paylaş"
            onPress={handleUpload}
            loading={uploading}
            disabled={!title.trim() || selectedCategories.length === 0 || uploading}
            style={styles.uploadButton}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      overflow: 'auto',
      maxHeight: '100vh',
    } : {}),
  },
  scrollContent: {
    padding: 16,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  section: {
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipWide: {
    minWidth: 140,
    paddingHorizontal: 18,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: Colors.surface,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filePlaceholder: {
    fontSize: 16,
    color: Colors.textLight,
  },
  fileLimitText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.backgroundDark,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  uploadButton: {
    marginTop: 24,
  },
  schoolTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 100,
    alignItems: 'center',
  },
  schoolTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolTypeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  schoolTypeTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default UploadNoteScreen;

