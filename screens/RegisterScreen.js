import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

const FormScrollView = Platform.OS === 'web' ? ScrollView : GHScrollView;
import { StatusBar } from 'expo-status-bar';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { Colors } from '../constants/Colors';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Ionicons } from '@expo/vector-icons';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
    school: '',
    schoolType: '', // 'lise', 'üniversite', 'ortaokul'
    department: '',
    class: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isHuman, setIsHuman] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  useEffect(() => {
    if (showCaptcha) {
      generateCaptcha();
    }
  }, [showCaptcha]);

  const handleCaptchaCheck = () => {
    const userAnswer = parseInt(captchaAnswer);
    if (userAnswer === captchaQuestion.answer) {
      setIsHuman(true);
      setShowCaptcha(false);
      setCaptchaAnswer('');
    } else {
      setError('Yanlış cevap! Lütfen tekrar deneyin.');
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

  const handleRegister = async () => {
    // Validasyon
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Lütfen zorunlu alanları doldurun (İsim, Soyisim, E-posta, Şifre)');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    // Şifre kısıtları kontrolü
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!isHuman) {
      setError('Lütfen "Ben robot değilim" seçeneğini işaretleyin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Kullanıcı oluştur
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Firestore'da kullanıcı bilgilerini kaydet
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nickname: formData.nickname || '',
        email: formData.email,
        school: formData.school || '',
        schoolType: formData.schoolType || '',
        department: formData.department || '',
        class: formData.class || '',
        createdAt: new Date().toISOString(),
        trustScore: 0,
        notesCount: 0,
        profileImage: '',
      });

      // Navigation will be handled by auth state listener
    } catch (err) {
      let errorMessage = 'Kayıt olurken bir hata oluştu';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta adresi ile zaten bir hesap oluşturulmuş. Lütfen giriş yapın veya farklı bir e-posta adresi kullanın.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf. Lütfen daha güçlü bir şifre seçin.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const scrollStyle =
    Platform.OS === 'web' ? [styles.scrollView, styles.scrollViewWeb] : styles.scrollView;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      enabled={Platform.OS === 'ios'}
    >
      <StatusBar style="dark" />
      <FormScrollView
        style={scrollStyle}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        bounces={Platform.OS !== 'web'}
      >
        <View style={styles.header}>
          <View style={styles.logoSmall}>
            <Text style={styles.logoTextSmall}>Not-Lan</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Hesap Oluştur</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomInput
            label="İsim *"
            value={formData.firstName}
            onChangeText={(value) => updateField('firstName', value)}
            placeholder="İsim"
            autoCapitalize="words"
          />

          <CustomInput
            label="Soyisim *"
            value={formData.lastName}
            onChangeText={(value) => updateField('lastName', value)}
            placeholder="Soyisim"
            autoCapitalize="words"
          />

          <CustomInput
            label="Nickname (Opsiyonel)"
            value={formData.nickname}
            onChangeText={(value) => updateField('nickname', value)}
            placeholder="Nickname"
            autoCapitalize="none"
          />

          <CustomInput
            label="E-posta *"
            value={formData.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="ornek@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View>
            <CustomInput
              label="Şifre *"
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              placeholder="••••••••"
              secureTextEntry
              showPasswordIcon
            />
            <Text style={styles.passwordHint}>
              Şifre en az 6 karakter, 1 büyük harf ve 1 sayı içermelidir
            </Text>
          </View>

          <CustomInput
            label="Şifre Tekrar *"
            value={formData.confirmPassword}
            onChangeText={(value) => updateField('confirmPassword', value)}
            placeholder="••••••••"
            secureTextEntry
            showPasswordIcon
          />

          <CustomInput
            label="Okul"
            value={formData.school}
            onChangeText={(value) => updateField('school', value)}
            placeholder={formData.schoolType === 'üniversite' ? 'Sadece isim yazın' : 'Okul adı'}
            autoCapitalize="words"
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Okul Türü</Text>
            <View style={styles.schoolTypeContainer}>
              {['Lise', 'Üniversite', 'Ortaokul'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.schoolTypeButton,
                    formData.schoolType === type.toLowerCase() && styles.schoolTypeButtonActive,
                  ]}
                  onPress={() => {
                    updateField('schoolType', type.toLowerCase());
                    // Okul türü değişince sınıfı ve bölümü sıfırla
                    if (formData.schoolType !== type.toLowerCase()) {
                      updateField('class', '');
                      updateField('department', '');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.schoolTypeText,
                      formData.schoolType === type.toLowerCase() && styles.schoolTypeTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {formData.schoolType === 'üniversite' && (
            <CustomInput
              label="Bölüm"
              value={formData.department}
              onChangeText={(value) => updateField('department', value)}
              placeholder="Bölüm adı"
              autoCapitalize="words"
            />
          )}

          {(formData.schoolType === 'lise' || formData.schoolType === 'üniversite' || formData.schoolType === 'ortaokul') && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Sınıf</Text>
              <View style={styles.classContainer}>
                {formData.schoolType === 'lise'
                  ? [9, 10, 11, 12].map((classNum) => (
                      <TouchableOpacity
                        key={classNum}
                        style={[
                          styles.classButton,
                          formData.class === classNum.toString() && styles.classButtonActive,
                        ]}
                        onPress={() => updateField('class', classNum.toString())}
                      >
                        <Text
                          style={[
                            styles.classText,
                            formData.class === classNum.toString() && styles.classTextActive,
                          ]}
                        >
                          {classNum}
                        </Text>
                      </TouchableOpacity>
                    ))
                  : formData.schoolType === 'üniversite'
                  ? ['hazırlık', '1', '2', '3', '4', '5', '6', '7', 'mezun'].map((classValue) => (
                      <TouchableOpacity
                        key={classValue}
                        style={[
                          styles.classButton,
                          styles.classButtonUni,
                          formData.class === classValue && styles.classButtonActive,
                        ]}
                        onPress={() => updateField('class', classValue)}
                      >
                        <Text
                          style={[
                            styles.classText,
                            formData.class === classValue && styles.classTextActive,
                          ]}
                        >
                          {classValue === 'hazırlık' ? 'Haz.' : classValue === 'mezun' ? 'Mezun' : classValue}
                        </Text>
                      </TouchableOpacity>
                    ))
                  : [5, 6, 7, 8].map((classNum) => (
                      <TouchableOpacity
                        key={classNum}
                        style={[
                          styles.classButton,
                          formData.class === classNum.toString() && styles.classButtonActive,
                        ]}
                        onPress={() => updateField('class', classNum.toString())}
                      >
                        <Text
                          style={[
                            styles.classText,
                            formData.class === classNum.toString() && styles.classTextActive,
                          ]}
                        >
                          {classNum}
                        </Text>
                      </TouchableOpacity>
                    ))}
              </View>
            </View>
          )}

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

          <Modal
            visible={showCaptcha}
            transparent={true}
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
                    Lütfen aşağıdaki işlemin sonucunu girin:
                  </Text>
                  <View style={styles.captchaQuestionBox}>
                    <Text style={styles.captchaQuestion}>
                      {captchaQuestion.num1} {captchaQuestion.operator === '×' ? '×' : captchaQuestion.operator} {captchaQuestion.num2} = ?
                    </Text>
                  </View>
                  
                  <TextInput
                    style={styles.captchaInput}
                    value={captchaAnswer}
                    onChangeText={setCaptchaAnswer}
                    placeholder="Cevabı girin"
                    keyboardType="numeric"
                    autoFocus
                  />
                  
                  <View style={styles.captchaButtons}>
                    <TouchableOpacity
                      style={styles.captchaButton}
                      onPress={handleCaptchaCheck}
                    >
                      <Text style={styles.captchaButtonText}>Doğrula</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.captchaButton, styles.captchaButtonSecondary]}
                      onPress={generateCaptcha}
                    >
                      <Ionicons name="refresh" size={18} color={Colors.primary} />
                      <Text style={[styles.captchaButtonText, styles.captchaButtonTextSecondary]}>Yenile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          <CustomButton
            title="Kayıt Ol"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
          />

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Zaten hesabınız var mı? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FormScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    ...Platform.select({
      web: { minHeight: 0 },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollViewWeb: {
    minHeight: 0,
    overflowY: 'scroll',
    WebkitOverflowScrolling: 'touch',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoSmall: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTextSmall: {
    color: Colors.surface,
    fontSize: 20,
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  registerButton: {
    marginTop: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  loginLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
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
  classContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classButtonUni: {
    minWidth: 60,
    paddingHorizontal: 8,
  },
  classButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  classText: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  classTextActive: {
    color: Colors.surface,
  },
  passwordHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginLeft: 4,
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
  closeButton: {
    padding: 4,
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

export default RegisterScreen;

