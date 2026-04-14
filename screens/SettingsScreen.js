import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, arrayRemove } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser, signOut } from 'firebase/auth';
import { storage, db, auth } from '../firebase/config';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { isAdmin } from '../utils/admin';

const SettingsScreen = ({ navigation, isDrawer = false, onClose }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showOpenSource, setShowOpenSource] = useState(false);
  const [isHuman, setIsHuman] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    loadUserData();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const admin = await isAdmin();
    setUserIsAdmin(admin);
  };

  useEffect(() => {
    if (showCaptcha) {
      generateCaptcha();
    }
  }, [showCaptcha]);

  const loadUserData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUser({ id: userDoc.id, ...userDoc.data() });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      uploadProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfileImage = async (imageUri) => {
    setLoading(true);
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      // Eski resmi sil
      if (user?.profileImage) {
        try {
          const oldImageRef = ref(storage, `profileImages/${userId}`);
          await deleteObject(oldImageRef);
        } catch (error) {
          console.log('Old image not found or already deleted');
        }
      }

      // Yeni resmi yükle
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const imageRef = ref(storage, `profileImages/${userId}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      // Firestore'da güncelle
      await updateDoc(doc(db, 'users', userId), {
        profileImage: downloadURL,
      });

      setUser((prev) => ({ ...prev, profileImage: downloadURL }));
      Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = () => {
    navigation.navigate('EditProfile', { user });
  };

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    if (operator === '+') {
      answer = num1 + num2;
    } else if (operator === '-') {
      answer = num1 - num2;
    } else {
      answer = num1 * num2;
    }
    
    setCaptchaQuestion({ num1, num2, operator, answer });
    setCaptchaAnswer('');
  };

  const handleCaptchaCheck = () => {
    const userAnswer = parseInt(captchaAnswer);
    if (userAnswer === captchaQuestion.answer) {
      setIsHuman(true);
      setShowCaptcha(false);
      setCaptchaAnswer('');
    } else {
      Alert.alert('Hata', 'Yanlış cevap! Lütfen tekrar deneyin.');
      generateCaptcha();
    }
  };

  const handleCaptchaClick = () => {
    if (!isHuman) {
      setShowCaptcha(true);
    } else {
      setIsHuman(false);
    }
  };

  const validatePassword = (password) => {
    // En az 6 karakter
    if (password.length < 6) {
      return 'Şifre en az 6 karakter olmalıdır';
    }
    // En az 1 büyük harf
    if (!/[A-Z]/.test(password)) {
      return 'Şifre en az 1 büyük harf içermelidir';
    }
    // En az 1 sayı
    if (!/[0-9]/.test(password)) {
      return 'Şifre en az 1 sayı içermelidir';
    }
    return null;
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
      return;
    }

    // Şifre standartları kontrolü
    const passwordError = validatePassword(passwordData.newPassword);
    if (passwordError) {
      Alert.alert('Hata', passwordError);
      return;
    }

    setLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı');
      setLoading(false);
      return;
    }

    try {
      // Kullanıcıyı yeniden doğrula
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Şifreyi güncelle
      await updatePassword(currentUser, passwordData.newPassword);

      Alert.alert('Başarılı', 'Şifre başarıyla güncellendi', [
        {
          text: 'Tamam',
          onPress: () => {
            setShowChangePassword(false);
            setPasswordData({
              currentPassword: '',
              newPassword: '',
              confirmPassword: '',
            });
          },
        },
      ]);
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Hata', 'Mevcut şifre yanlış');
      } else {
        Alert.alert('Hata', 'Şifre değiştirilirken bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    // Captcha kontrolü
    if (!isHuman) {
      Alert.alert('Robot Doğrulaması', 'Hesap silmek için önce robot doğrulamasını tamamlamanız gerekiyor.');
      return;
    }

    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinizden emin misiniz? Tüm notlarınız, beğenileriniz, güvenleriniz, yorumlarınız ve mesajlarınız silinecektir. Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setIsHuman(false); // Captcha'yı sıfırla
            setLoading(true);
            try {
              const userId = auth.currentUser?.uid;
              if (!userId) return;

              // 1. Kullanıcının tüm notlarını bul ve sil
              const notesQuery = query(
                collection(db, 'notes'),
                where('userId', '==', userId)
              );
              const notesSnapshot = await getDocs(notesQuery);
              
              const deletePromises = [];
              
              // Her not için dosyayı ve ilişkili verileri sil
              for (const noteDoc of notesSnapshot.docs) {
                const noteData = noteDoc.data();
                
                // Storage'dan dosyayı sil (dosya yoksa hata vermesin)
                if (noteData.filePath) {
                  try {
                    await deleteObject(ref(storage, noteData.filePath));
                  } catch (err) {
                    // Dosya zaten silinmiş olabilir, bu normal
                    if (err.code !== 'storage/object-not-found') {
                      console.error('Error deleting file:', err);
                    }
                  }
                }
                
                // Notun beğenilerini, güvenlerini ve yorumlarını sil
                const [likesSnapshot, trustsSnapshot, commentsSnapshot] = await Promise.all([
                  getDocs(query(collection(db, 'likes'), where('noteId', '==', noteDoc.id))),
                  getDocs(query(collection(db, 'trusts'), where('noteId', '==', noteDoc.id))),
                  getDocs(query(collection(db, 'comments'), where('noteId', '==', noteDoc.id))),
                ]);
                
                likesSnapshot.forEach((likeDoc) => deletePromises.push(deleteDoc(likeDoc.ref)));
                trustsSnapshot.forEach((trustDoc) => deletePromises.push(deleteDoc(trustDoc.ref)));
                
                // Yorumları ve cevaplarını sil
                for (const commentDoc of commentsSnapshot.docs) {
                  deletePromises.push(deleteDoc(commentDoc.ref));
                  
                  // Cevapları da sil
                  const repliesSnapshot = await getDocs(
                    query(collection(db, 'comments'), where('parentCommentId', '==', commentDoc.id))
                  );
                  repliesSnapshot.forEach((replyDoc) => {
                    deletePromises.push(deleteDoc(replyDoc.ref));
                  });
                }
                
                // Notu sil
                deletePromises.push(deleteDoc(noteDoc.ref));
              }

              // 2. Kullanıcının beğenilerini sil (başkalarının notlarına verdiği)
              // Ayrıca bu beğenilerin notlardaki sayılarını da azalt
              const userLikesQuery = query(
                collection(db, 'likes'),
                where('userId', '==', userId)
              );
              const userLikesSnapshot = await getDocs(userLikesQuery);
              
              for (const likeDoc of userLikesSnapshot.docs) {
                const likeData = likeDoc.data();
                deletePromises.push(deleteDoc(likeDoc.ref));
                
                // Notun beğeni sayısını azalt
                if (likeData.noteId) {
                  try {
                    const noteRef = doc(db, 'notes', likeData.noteId);
                    const noteDoc = await getDoc(noteRef);
                    if (noteDoc.exists()) {
                      const currentLikes = noteDoc.data().likesCount || 0;
                      const newLikes = Math.max(0, currentLikes - 1);
                      await updateDoc(noteRef, { likesCount: newLikes });
                    }
                  } catch (err) {
                    console.error('Error updating note likes count:', err);
                  }
                }
              }

              // 3. Kullanıcının güvenlerini sil (başkalarının notlarına verdiği)
              // Ayrıca bu güvenlerin notlardaki sayılarını da azalt
              const userTrustsQuery = query(
                collection(db, 'trusts'),
                where('userId', '==', userId)
              );
              const userTrustsSnapshot = await getDocs(userTrustsQuery);
              
              for (const trustDoc of userTrustsSnapshot.docs) {
                const trustData = trustDoc.data();
                deletePromises.push(deleteDoc(trustDoc.ref));
                
                // Notun güven sayısını azalt
                if (trustData.noteId) {
                  try {
                    const noteRef = doc(db, 'notes', trustData.noteId);
                    const noteDoc = await getDoc(noteRef);
                    if (noteDoc.exists()) {
                      const currentTrusts = noteDoc.data().trustCount || 0;
                      const newTrusts = Math.max(0, currentTrusts - 1);
                      await updateDoc(noteRef, { trustCount: newTrusts });
                    }
                  } catch (err) {
                    console.error('Error updating note trust count:', err);
                  }
                }
              }

              // 4. Kullanıcının yorumlarını sil (tüm notlardaki)
              const userCommentsQuery = query(
                collection(db, 'comments'),
                where('userId', '==', userId)
              );
              const userCommentsSnapshot = await getDocs(userCommentsQuery);
              userCommentsSnapshot.forEach((commentDoc) => {
                deletePromises.push(deleteDoc(commentDoc.ref));
              });

              // 5. Kullanıcının sohbetlerini ve mesajlarını sil
              const chatsQuery = query(
                collection(db, 'chats'),
                where('participants', 'array-contains', userId)
              );
              const chatsSnapshot = await getDocs(chatsQuery);
              
              for (const chatDoc of chatsSnapshot.docs) {
                try {
                  // Sohbet mesajlarını sil
                  const messagesSnapshot = await getDocs(
                    query(collection(db, 'messages'), where('chatId', '==', chatDoc.id))
                  );
                  messagesSnapshot.forEach((messageDoc) => {
                    deletePromises.push(
                      deleteDoc(messageDoc.ref).catch((err) => {
                        // İzin hatası olsa bile devam et
                        console.error('Error deleting message:', err);
                      })
                    );
                  });
                  
                  // Sohbeti sil (grup sohbeti ise sadece participants'tan çıkar)
                  const chatData = chatDoc.data();
                  if (chatData.isGroup && chatData.participants && chatData.participants.length > 1) {
                    // Grup sohbetinden çık, sohbeti silme
                    try {
                      await updateDoc(chatDoc.ref, {
                        participants: arrayRemove(userId)
                      });
                    } catch (err) {
                      console.error('Error removing from group chat:', err);
                    }
                  } else {
                    // Bireysel sohbet veya tek kişi kaldıysa sohbeti sil
                    deletePromises.push(
                      deleteDoc(chatDoc.ref).catch((err) => {
                        // İzin hatası olsa bile devam et
                        console.error('Error deleting chat:', err);
                      })
                    );
                  }
                } catch (err) {
                  console.error('Error processing chat:', err);
                }
              }

              // 6. Kullanıcının profil fotoğrafını sil
              if (user?.profileImage) {
                try {
                  await deleteObject(ref(storage, `profileImages/${userId}`));
                } catch (err) {
                  console.error('Error deleting profile image:', err);
                }
              }

              // 7. Tüm silme işlemlerini bekle
              await Promise.all(deletePromises);

              // 8. Firestore'dan kullanıcıyı sil
              await deleteDoc(doc(db, 'users', userId));

              // 9. Auth'dan kullanıcıyı sil
              await deleteUser(auth.currentUser);

              // 10. Çıkış yap ve giriş ekranına yönlendir
              await signOut(auth);
              
              Alert.alert('Başarılı', 'Hesabınız ve tüm verileriniz silindi', [
                {
                  text: 'Tamam',
                  onPress: () => {
                    // Navigation will be handled by auth state listener
                  },
                },
              ]);
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Hata', 'Hesap silinirken bir hata oluştu: ' + error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    // Web için confirm, mobil için Alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Çıkış yapmak istediğinizden emin misiniz?');
      if (!confirmed) return;
      
      try {
        await signOut(auth);
        // Drawer açıksa kapat
        if (isDrawer && onClose) {
          onClose();
        }
        // Navigation will be handled by auth state listener
      } catch (error) {
        console.error('Error signing out:', error);
        window.alert('Çıkış yapılırken bir hata oluştu: ' + error.message);
      }
    } else {
      Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinizden emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigation will be handled by auth state listener
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu');
            }
          },
        },
      ]);
    }
  };

  const SettingItem = ({ icon, title, onPress, danger = false }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={24}
        color={danger ? Colors.error : Colors.textSecondary}
      />
      <Text style={[styles.settingText, danger && styles.settingTextDanger]}>
        {title}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );

  const handleBack = () => {
    if (isDrawer && onClose) {
      onClose();
    } else if (navigation) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isDrawer && (
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ayarlar</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <SettingItem
            icon="camera"
            title="Profil Fotoğrafı Ekle"
            onPress={handlePickImage}
          />
          <SettingItem
            icon="person"
            title="Profil Bilgileri Değiştir"
            onPress={handleUpdateProfile}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Güvenlik</Text>
          <SettingItem
            icon="lock-closed"
            title="Şifre Değiştir"
            onPress={() => setShowChangePassword(!showChangePassword)}
          />

          {showChangePassword && (
            <View style={styles.passwordForm}>
              <CustomInput
                label="Mevcut Şifre"
                value={passwordData.currentPassword}
                onChangeText={(value) =>
                  setPasswordData((prev) => ({ ...prev, currentPassword: value }))
                }
                placeholder="Mevcut şifrenizi girin"
                secureTextEntry
              />
              <CustomInput
                label="Yeni Şifre"
                value={passwordData.newPassword}
                onChangeText={(value) =>
                  setPasswordData((prev) => ({ ...prev, newPassword: value }))
                }
                placeholder="Yeni şifrenizi girin"
                secureTextEntry
              />
              <CustomInput
                label="Yeni Şifre Tekrar"
                value={passwordData.confirmPassword}
                onChangeText={(value) =>
                  setPasswordData((prev) => ({ ...prev, confirmPassword: value }))
                }
                placeholder="Yeni şifrenizi tekrar girin"
                secureTextEntry
              />
              <CustomButton
                title="Şifreyi Güncelle"
                onPress={handleChangePassword}
                loading={loading}
                style={styles.updateButton}
              />
            </View>
          )}
        </View>

        {userIsAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yönetim</Text>
            <SettingItem
              icon="shield"
              title="Admin Paneli"
              onPress={() => {
                if (isDrawer && onClose) {
                  onClose();
                }
                navigation.navigate('AdminPanel');
              }}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bilgi</Text>
          <SettingItem
            icon="information-circle"
            title="Hakkında"
            onPress={() => setShowAbout(true)}
          />
          <SettingItem
            icon="code"
            title="Açık Kaynak Kodları"
            onPress={() => setShowOpenSource(true)}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            icon="log-out"
            title="Çıkış Yap"
            onPress={handleLogout}
            danger
          />
          <View style={styles.deleteAccountContainer}>
            <View style={styles.captchaContainer}>
              <TouchableOpacity
                style={styles.captchaCheckbox}
                onPress={handleCaptchaClick}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isHuman && styles.checkboxChecked]}>
                  {isHuman && <Ionicons name="checkmark" size={16} color={Colors.surface} />}
                </View>
                <Text style={styles.captchaText}>Ben robot değilim</Text>
              </TouchableOpacity>
            </View>
            <SettingItem
              icon="trash"
              title="Hesabı Sil"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>
      </ScrollView>

      {/* Hakkında Modal */}
      <Modal
        visible={showAbout}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAbout(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hakkında</Text>
              <TouchableOpacity
                onPress={() => setShowAbout(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.aboutLogo}>
                <Text style={styles.logoText}>Not-Lan</Text>
              </View>
              <Text style={styles.aboutVersion}>Versiyon 1.0.0</Text>
              <Text style={styles.aboutDescription}>
                Not-Lan, öğrencilerin ders notlarını paylaşabileceği, birbirleriyle iletişim kurabileceği ve güvenilir not kaynaklarına erişebileceği modern bir platformdur.
              </Text>
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Özellikler</Text>
                <Text style={styles.aboutFeature}>• Not paylaşma ve görüntüleme</Text>
                <Text style={styles.aboutFeature}>• Gerçek zamanlı mesajlaşma</Text>
                <Text style={styles.aboutFeature}>• Beğeni ve güven sistemi</Text>
                <Text style={styles.aboutFeature}>• Yorum ve tartışma</Text>
                <Text style={styles.aboutFeature}>• Kategori filtreleme</Text>
                <Text style={styles.aboutFeature}>• Profil yönetimi</Text>
              </View>
              <Text style={styles.aboutFooter}>
                © 2024 Not-Lan. Tüm hakları saklıdır.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Açık Kaynak Kodları Modal */}
      <Modal
        visible={showOpenSource}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOpenSource(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Açık Kaynak Kodları</Text>
              <TouchableOpacity
                onPress={() => setShowOpenSource(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalContent} 
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.opensourceDescription}>
                Not-Lan aşağıdaki açık kaynak kütüphaneleri kullanmaktadır:
              </Text>
              
              <View style={styles.opensourceList}>
                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>React Native</Text>
                  <Text style={styles.opensourceVersion}>0.81.5</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/facebook/react-native')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>Expo</Text>
                  <Text style={styles.opensourceVersion}>~54.0.25</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/expo')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>Firebase</Text>
                  <Text style={styles.opensourceVersion}>12.6.0</Text>
                  <Text style={styles.opensourceLicense}>Apache 2.0 License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/firebase/firebase-js-sdk')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>React Navigation</Text>
                  <Text style={styles.opensourceVersion}>7.x</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/react-navigation/react-navigation')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>@expo/vector-icons</Text>
                  <Text style={styles.opensourceVersion}>15.0.3</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/vector-icons')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>expo-image-picker</Text>
                  <Text style={styles.opensourceVersion}>17.0.8</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/expo/tree/main/packages/expo-image-picker')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>expo-document-picker</Text>
                  <Text style={styles.opensourceVersion}>14.0.7</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/expo/tree/main/packages/expo-document-picker')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>react-native-safe-area-context</Text>
                  <Text style={styles.opensourceVersion}>5.6.2</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/th3rdwave/react-native-safe-area-context')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>React</Text>
                  <Text style={styles.opensourceVersion}>19.1.0</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/facebook/react')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>@react-navigation/native</Text>
                  <Text style={styles.opensourceVersion}>7.1.21</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/react-navigation/react-navigation')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>@react-navigation/stack</Text>
                  <Text style={styles.opensourceVersion}>7.6.7</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/react-navigation/react-navigation')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>@react-navigation/bottom-tabs</Text>
                  <Text style={styles.opensourceVersion}>7.8.6</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/react-navigation/react-navigation')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>react-native-gesture-handler</Text>
                  <Text style={styles.opensourceVersion}>2.28.0</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/software-mansion/react-native-gesture-handler')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>react-native-screens</Text>
                  <Text style={styles.opensourceVersion}>4.16.0</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/software-mansion/react-native-screens')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>@react-native-async-storage/async-storage</Text>
                  <Text style={styles.opensourceVersion}>2.2.0</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/react-native-async-storage/async-storage')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>expo-file-system</Text>
                  <Text style={styles.opensourceVersion}>19.0.19</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/expo/tree/main/packages/expo-file-system')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>expo-notifications</Text>
                  <Text style={styles.opensourceVersion}>0.32.13</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/expo/tree/main/packages/expo-notifications')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.opensourceItem}>
                  <Text style={styles.opensourceName}>expo-status-bar</Text>
                  <Text style={styles.opensourceVersion}>3.0.8</Text>
                  <Text style={styles.opensourceLicense}>MIT License</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/expo/expo/tree/main/packages/expo-status-bar')}
                    style={styles.opensourceLink}
                  >
                    <Text style={styles.opensourceLinkText}>GitHub →</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.opensourceFooter}>
                Bu uygulama açık kaynak kodludur ve yukarıdaki kütüphanelerin lisanslarına tabidir.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Captcha Modal */}
      <Modal
        visible={showCaptcha}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCaptcha(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.captchaModal}>
            <View style={styles.captchaHeader}>
              <Text style={styles.captchaTitle}>Robot Doğrulaması</Text>
              <TouchableOpacity
                onPress={() => setShowCaptcha(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.captchaContent}>
              <Text style={styles.captchaQuestionText}>
                Aşağıdaki işlemin sonucunu giriniz:
              </Text>
              
              <View style={styles.captchaQuestionBox}>
                <Text style={styles.captchaQuestion}>
                  {captchaQuestion.num1} {captchaQuestion.operator} {captchaQuestion.num2} = ?
                </Text>
              </View>
              
              <TextInput
                style={styles.captchaInput}
                placeholder="Cevap"
                placeholderTextColor={Colors.textLight}
                value={captchaAnswer}
                onChangeText={setCaptchaAnswer}
                keyboardType="numeric"
                autoFocus
              />
              
              <View style={styles.captchaButtons}>
                <TouchableOpacity
                  style={[styles.captchaButton, styles.captchaButtonSecondary]}
                  onPress={() => {
                    generateCaptcha();
                  }}
                >
                  <Ionicons name="refresh" size={18} color={Colors.primary} />
                  <Text style={[styles.captchaButtonText, styles.captchaButtonTextSecondary]}>
                    Yenile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.captchaButton}
                  onPress={handleCaptchaCheck}
                >
                  <Text style={styles.captchaButtonText}>Doğrula</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  section: {
    backgroundColor: Colors.surface,
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  settingTextDanger: {
    color: Colors.error,
  },
  passwordForm: {
    padding: 16,
    backgroundColor: Colors.background,
  },
  updateButton: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalContentContainer: {
    paddingBottom: 30,
  },
  aboutLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: Colors.surface,
    fontSize: 24,
    fontWeight: '700',
  },
  aboutVersion: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  aboutDescription: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  aboutSection: {
    marginBottom: 20,
  },
  aboutSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  aboutFeature: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 8,
  },
  aboutFooter: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  opensourceDescription: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 20,
  },
  opensourceList: {
    marginBottom: 20,
  },
  opensourceItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  opensourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  opensourceVersion: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  opensourceLicense: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 8,
  },
  opensourceLink: {
    marginTop: 8,
  },
  opensourceLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  opensourceFooter: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    lineHeight: 18,
  },
  deleteAccountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  captchaContainer: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  captchaCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  captchaText: {
    fontSize: 14,
    color: Colors.text,
  },
  captchaModal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  captchaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  captchaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  captchaContent: {
    alignItems: 'center',
  },
  captchaQuestionText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  captchaQuestionBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  captchaQuestion: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  captchaInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    width: '100%',
    textAlign: 'center',
    marginBottom: 20,
  },
  captchaButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  captchaButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captchaButtonSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    gap: 6,
  },
  captchaButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  captchaButtonTextSecondary: {
    color: Colors.primary,
  },
});

export default SettingsScreen;

