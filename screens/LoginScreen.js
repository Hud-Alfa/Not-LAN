import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { Colors } from '../constants/Colors';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const LoginScreen = ({ navigation }) => {
  let width = 0;
  try {
    const dimensions = useWindowDimensions();
    width = dimensions.width;
  } catch (e) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      width = window.innerWidth;
    }
  }
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    // Oturum kalıcılığı Firebase Auth tarafından zaten AsyncStorage ile sağlanıyor
    // Checkbox sadece kullanıcı tercihini gösteriyor

    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Kullanıcının Firestore'da olup olmadığını kontrol et (silinmiş kullanıcı kontrolü)
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        // Kullanıcı silinmiş, çıkış yap
        await auth.signOut();
        setError('Bu hesap silinmiş. Giriş yapılamaz.');
        setLoading(false);
        return;
      }
      
      // Navigation will be handled by auth state listener
    } catch (err) {
      let errorMessage = 'Giriş yapılırken bir hata oluştu';
      
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'E-posta adresi bulunamadı';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Şifre yanlış';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      } else if (err.code === 'auth/invalid-credential') {
        errorMessage = 'E-posta veya şifre yanlış';
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'Bu hesap devre dışı bırakılmış';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Eğer email zaten girilmişse direkt gönder, yoksa modal aç
    if (email.trim()) {
      setResetEmail(email);
      setShowForgotPasswordModal(true);
    } else {
      setShowForgotPasswordModal(true);
    }
  };

  const handleSendResetEmail = async () => {
    const emailToReset = resetEmail.trim() || email.trim();
    
    if (!emailToReset) {
      Alert.alert('Hata', 'Lütfen e-posta adresinizi girin');
      return;
    }

    // E-posta formatı kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToReset)) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, emailToReset);
      Alert.alert(
        'Başarılı',
        'Şifre sıfırlama e-postası gönderildi. Lütfen e-posta kutunuzu kontrol edin.',
        [
          {
            text: 'Tamam',
            onPress: () => {
              setShowForgotPasswordModal(false);
              setResetEmail('');
            },
          },
        ]
      );
    } catch (err) {
      let errorMessage = 'Şifre sıfırlama e-postası gönderilemedi';
      
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'Bu e-posta adresi ile kayıtlı bir hesap bulunamadı';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      Alert.alert('Hata', errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>Not-Lan</Text>
          </View>
        </View>

        <View style={[styles.formContainer, isDesktop && styles.formContainerDesktop]}>
          <Text style={styles.title}>Hoş Geldiniz</Text>
          <Text style={styles.subtitle}>Not paylaşım platformuna giriş yapın</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomInput
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <CustomInput
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            showPasswordIcon
          />

          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Şifremi Sıfırla</Text>
          </TouchableOpacity>

          <View style={styles.captchaContainer}>
            <TouchableOpacity
              style={styles.captchaCheckbox}
              onPress={() => setKeepSignedIn(!keepSignedIn)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, keepSignedIn && styles.checkboxChecked]}>
                {keepSignedIn && <Ionicons name="checkmark" size={16} color={Colors.surface} />}
              </View>
              <Text style={styles.captchaText}>Oturumumu açık tut</Text>
            </TouchableOpacity>
          </View>

          <CustomButton
            title="Giriş Yap"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Hesabınız yok mu? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signupLink}>Hesap Oluştur</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Şifremi Unuttum Modal */}
      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowForgotPasswordModal(false);
          setResetEmail('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şifremi Unuttum</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowForgotPasswordModal(false);
                  setResetEmail('');
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Şifrenizi sıfırlamak için e-posta adresinizi girin. Size şifre sıfırlama bağlantısı göndereceğiz.
              </Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="E-posta adresiniz"
                placeholderTextColor={Colors.textLight}
                value={resetEmail || email}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus={!email}
              />
              
              <CustomButton
                title="Şifre Sıfırlama E-postası Gönder"
                onPress={handleSendResetEmail}
                loading={resetLoading}
                disabled={!resetEmail.trim() && !email.trim()}
                style={styles.resetButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    color: Colors.surface,
    fontSize: 28,
    fontWeight: '700',
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formContainerDesktop: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  signupLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  captchaContainer: {
    marginBottom: 16,
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
    maxWidth: 400,
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
  modalDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    marginBottom: 20,
  },
  resetButton: {
    marginTop: 8,
  },
});

export default LoginScreen;

