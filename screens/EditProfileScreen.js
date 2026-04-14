import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';

const EditProfileScreen = ({ route, navigation }) => {
  const { user: initialUser } = route.params;
  const [formData, setFormData] = useState({
    nickname: '',
    school: '',
    schoolType: '', // 'lise', 'üniversite', 'ortaokul'
    department: '',
    class: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialUser) {
      setFormData({
        nickname: initialUser.nickname || '',
        school: initialUser.school || '',
        schoolType: initialUser.schoolType || '',
        department: initialUser.department || '',
        class: initialUser.class || '',
      });
    }
  }, [initialUser]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', userId);
      const updatedData = {
        nickname: formData.nickname.trim() || '',
        school: formData.school.trim() || '',
        schoolType: formData.schoolType || '',
        department: formData.department.trim() || '',
        class: formData.class || '',
      };
      
      await updateDoc(userRef, updatedData);

      // Tüm notlardaki userInfo'yu güncelle
      const notesQuery = query(
        collection(db, 'notes'),
        where('userId', '==', userId)
      );
      const notesSnapshot = await getDocs(notesQuery);
      
      const updatePromises = [];
      notesSnapshot.forEach((noteDoc) => {
        const currentUserInfo = noteDoc.data().userInfo || {};
        updatePromises.push(
          updateDoc(noteDoc.ref, {
            userInfo: {
              ...currentUserInfo,
              ...updatedData,
            },
          })
        );
      });
      
      await Promise.all(updatePromises);

      Alert.alert('Başarılı', 'Profil bilgileri güncellendi', [
        {
          text: 'Tamam',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Hata', 'Profil güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Profil Düzenle</Text>

          <CustomInput
            label="Nickname (Opsiyonel)"
            value={formData.nickname}
            onChangeText={(value) => updateField('nickname', value)}
            placeholder="Nickname"
            autoCapitalize="none"
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

          <CustomButton
            title="Kaydet"
            onPress={handleSave}
            loading={loading}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: 24,
    paddingTop: 40,
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
  saveButton: {
    marginTop: 16,
  },
});

export default EditProfileScreen;
