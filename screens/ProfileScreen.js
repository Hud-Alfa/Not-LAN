import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import CustomButton from '../components/CustomButton';
import { isAdmin } from '../utils/admin';

const ProfileScreen = ({ route, navigation }) => {
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
  
  const currentUserId = auth.currentUser?.uid;
  const [user, setUser] = useState(null);
  const [userNotes, setUserNotes] = useState([]);
  const [trustScore, setTrustScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState(null);
  const [showTrustScoreModal, setShowTrustScoreModal] = useState(false);
  const [trustScoreDetails, setTrustScoreDetails] = useState({ likes: 0, trusts: 0, notes: 0 });
  const [displayUserId, setDisplayUserId] = useState(currentUserId);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  // Tab'dan gelindiğinde stack'teki Profile ekranını kapat ve kendi profilini göster
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const currentParams = route?.params || {};
      const profileUserId = currentParams?.userId;
      
      // Eğer params'da userId yoksa, tab'dan gelindi demektir - kendi profilini göster
      if (!profileUserId) {
        setDisplayUserId(currentUserId);
      } else {
        // Stack'ten gelindi, params'daki userId'yi kullan
        setDisplayUserId(profileUserId);
      }
    });

    return unsubscribe;
  }, [navigation, route, currentUserId]);

  // İlk yüklemede ve route params değiştiğinde displayUserId'yi ayarla
  useEffect(() => {
    const currentParams = route?.params || {};
    const profileUserId = currentParams?.userId;
    
    // Eğer params'da userId yoksa, kendi profilini göster
    if (!profileUserId) {
      setDisplayUserId(currentUserId);
    } else {
      // Stack'ten gelindi, params'daki userId'yi kullan
      setDisplayUserId(profileUserId);
    }
  }, [route?.params?.userId, currentUserId]);

  const isOwnProfile = displayUserId === currentUserId;

  useEffect(() => {
    if (!displayUserId) return;
    
    // State'i sıfırla
    setUser(null);
    setUserNotes([]);
    setLoading(true);
    setNotesLoading(true);
    setNotesError(null);
    setTrustScore(0);
    
    const unsubscribeProfile = loadUserProfile();
    const unsubscribeNotes = loadUserNotes();
    
    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeNotes) unsubscribeNotes();
    };
  }, [displayUserId]);
  
  useEffect(() => {
    calculateTrustScore();
  }, [userNotes]);

  // Real-time güven puanı güncellemesi için notları dinle
  useEffect(() => {
    if (!displayUserId) return;

    const notesQuery = query(
      collection(db, 'notes'),
      where('userId', '==', displayUserId)
    );

    const unsubscribe = onSnapshot(
      notesQuery,
      () => {
        // Notlar değiştiğinde güven puanını yeniden hesapla
        calculateTrustScore();
      },
      (error) => {
        // İzin hatası normal, sessizce yoksay
        if (error.code !== 'permission-denied') {
          console.error('Error listening to notes:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [displayUserId]);

  // Real-time beğeni ve güven değişikliklerini dinle
  useEffect(() => {
    if (!displayUserId) return;

    // Kullanıcının tüm notlarını al
    const notesQuery = query(
      collection(db, 'notes'),
      where('userId', '==', displayUserId)
    );

    let noteIds = [];
    const unsubscribeNotes = onSnapshot(
      notesQuery,
      (snapshot) => {
        noteIds = [];
        snapshot.forEach((doc) => {
          if (doc.exists()) {
            noteIds.push(doc.id);
          }
        });
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error listening to notes for trust score:', error);
        }
      }
    );

    // Her not için beğeni ve güven değişikliklerini dinle
    const unsubscribes = [];
    
    // İlk not listesini al ve dinlemeleri kur
    const setupListeners = async () => {
      try {
        const notesSnapshot = await getDocs(notesQuery);
        noteIds = [];
        notesSnapshot.forEach((doc) => {
          if (doc.exists()) {
            noteIds.push(doc.id);
          }
        });

        // Her not için beğeni ve güven değişikliklerini dinle
        noteIds.forEach((noteId) => {
          // Beğenileri dinle
          const likesQuery = query(
            collection(db, 'likes'),
            where('noteId', '==', noteId)
          );
          const unsubscribeLikes = onSnapshot(
            likesQuery,
            () => {
              // Beğeni değiştiğinde güven puanını yeniden hesapla
              calculateTrustScore();
            },
            (error) => {
              if (error.code !== 'permission-denied') {
                console.error('Error listening to likes:', error);
              }
            }
          );
          unsubscribes.push(unsubscribeLikes);

          // Güvenleri dinle
          const trustsQuery = query(
            collection(db, 'trusts'),
            where('noteId', '==', noteId)
          );
          const unsubscribeTrusts = onSnapshot(
            trustsQuery,
            () => {
              // Güven değiştiğinde güven puanını yeniden hesapla
              calculateTrustScore();
            },
            (error) => {
              if (error.code !== 'permission-denied') {
                console.error('Error listening to trusts:', error);
              }
            }
          );
          unsubscribes.push(unsubscribeTrusts);
        });
      } catch (error) {
        if (error.code !== 'permission-denied') {
          console.error('Error setting up trust score listeners:', error);
        }
      }
    };

    setupListeners();

    // Notlar değiştiğinde dinlemeleri yeniden kur
    const unsubscribeNotesChange = onSnapshot(
      notesQuery,
      () => {
        // Önceki dinlemeleri temizle
        unsubscribes.forEach((unsub) => unsub());
        unsubscribes.length = 0;
        // Yeni dinlemeleri kur
        setupListeners();
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error listening to notes changes:', error);
        }
      }
    );

    return () => {
      unsubscribeNotes();
      unsubscribeNotesChange();
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [displayUserId]);

  const loadUserProfile = () => {
    if (!displayUserId) {
      setLoading(false);
      return () => {};
    }
    
    const userRef = doc(db, 'users', displayUserId);
    const unsubscribe = onSnapshot(
      userRef,
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Admin profili koruması - sadece admin kendi profilini görebilir
          const userIsAdmin = userData.isAdmin === true || userData.isAdmin === 'True' || userData.isAdmin === 'true';
          if (userIsAdmin && displayUserId !== currentUserId) {
            // Mevcut kullanıcının admin olup olmadığını kontrol et
            const currentUserIsAdmin = await isAdmin();
            if (!currentUserIsAdmin) {
              Alert.alert('Erişim Engellendi', 'Bu profile erişim yetkiniz yok', [
                { text: 'Tamam', onPress: () => navigation.goBack() },
              ]);
              setUser(null);
              setLoading(false);
              return;
            }
          }
          
          setUser(userData);
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (error) => {
        // İzin hatası normal (kullanıcı silinmiş olabilir), sessizce yoksay
        if (error.code !== 'permission-denied') {
          console.error('Error loading profile:', error);
          Alert.alert('Hata', 'Profil yüklenirken bir hata oluştu');
        }
        setLoading(false);
      }
    );
    
    return unsubscribe;
  };

  const loadUserNotes = () => {
    if (!displayUserId) {
      setNotesLoading(false);
      return () => {};
    }
    
    setNotesLoading(true);
    setNotesError(null);
    
    // Index gerektirmemek için orderBy kullanmıyoruz, client-side'da sıralıyoruz
    const notesQuery = query(
      collection(db, 'notes'),
      where('userId', '==', displayUserId)
    );
    
    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const notesData = [];
        snapshot.forEach((doc) => {
          if (doc.exists()) {
            notesData.push({ id: doc.id, ...doc.data() });
          }
        });
        // Tarihe göre manuel sıralama (güvenlik için)
        notesData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setUserNotes(notesData);
        setNotesLoading(false);
        setNotesError(null);
      },
      (error) => {
        console.error('Error loading notes:', error);
        setNotesLoading(false);
        if (error.code !== 'permission-denied') {
          setNotesError('Notlar yüklenirken bir hata oluştu');
        }
      }
    );
    
    return unsubscribe;
  };

  const calculateTrustScore = async () => {
    if (!displayUserId) return;
    
    try {
      // Kullanıcının tüm notlarını al
      const notesQuery = query(
        collection(db, 'notes'),
        where('userId', '==', displayUserId)
      );
      const notesSnapshot = await getDocs(notesQuery);
      
      let totalScore = 0;
      let totalLikes = 0;
      let totalTrusts = 0;
      const noteIds = [];
      
      notesSnapshot.forEach((noteDoc) => {
        const noteData = noteDoc.data();
        noteIds.push(noteDoc.id);
        // Her not için beğeni ve güven sayılarını topla
        const likes = noteData.likesCount || 0;
        const trusts = noteData.trustCount || 0;
        totalLikes += likes;
        totalTrusts += trusts;
        // Beğeni = 1 puan, Güven = 2 puan
        totalScore += likes * 1;
        totalScore += trusts * 2;
      });
      
      // Detayları kaydet
      setTrustScoreDetails({
        likes: totalLikes,
        trusts: totalTrusts,
        notes: notesSnapshot.size,
      });
      
      // Güven puanını her zaman güncelle (silinen notlar için puanlar kaldırılsın)
      setTrustScore(totalScore);
      // Kullanıcı dokümanına kaydet (sadece kendi profili için)
      if (displayUserId === currentUserId) {
        await updateDoc(doc(db, 'users', displayUserId), {
          trustScore: totalScore,
        });
      }
    } catch (error) {
      console.error('Error calculating trust score:', error);
    }
  };

  const handleReport = () => {
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Hata', 'Lütfen şikayet nedeninizi belirtin');
      return;
    }

    if (reportReason.trim().length < 10) {
      Alert.alert('Hata', 'Şikayet nedeni en az 10 karakter olmalıdır');
      return;
    }

    try {
      await addDoc(collection(db, 'reports'), {
        reportedUserId: displayUserId,
        reporterUserId: currentUserId,
        type: 'user',
        reason: reportReason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Başarılı', 'Şikayetiniz alındı');
      setShowReportModal(false);
      setReportReason('');
    } catch (error) {
      Alert.alert('Hata', 'Şikayet gönderilirken bir hata oluştu');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  const displayName =
    user.nickname ||
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    'Kullanıcı';
  
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  
  const getSchoolTypeText = () => {
    if (!user.schoolType) return '';
    const types = {
      'lise': 'Lise',
      'üniversite': 'Üniversite',
      'ortaokul': 'Ortaokul',
    };
    return types[user.schoolType] || '';
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <StatusBar style="dark" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
      >
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              {!isOwnProfile && (
                <TouchableOpacity 
                  onPress={handleReport}
                  style={styles.reportHeaderButton}
                >
                  <Ionicons name="flag" size={24} color={Colors.error} />
                </TouchableOpacity>
              )}
              {isOwnProfile && (
                <TouchableOpacity 
                  onPress={() => {
                    if (isDesktop && Platform.OS === 'web' && typeof window !== 'undefined' && window.openSettingsDrawer) {
                      window.openSettingsDrawer();
                    } else if (navigation) {
                      navigation.navigate('Settings');
                    }
                  }} 
                  style={styles.settingsHeaderButton}
                >
                  <Ionicons name="settings" size={24} color={Colors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        
        {isDesktop && (
          <View style={styles.desktopHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              {!isOwnProfile && (
                <TouchableOpacity 
                  onPress={handleReport}
                  style={styles.reportHeaderButton}
                >
                  <Ionicons name="flag" size={24} color={Colors.error} />
                </TouchableOpacity>
              )}
              {isOwnProfile && (
                <TouchableOpacity 
                  onPress={() => {
                    if (isDesktop && Platform.OS === 'web' && typeof window !== 'undefined' && window.openSettingsDrawer) {
                      window.openSettingsDrawer();
                    } else if (navigation) {
                      navigation.navigate('Settings');
                    }
                  }} 
                  style={styles.settingsHeaderButton}
                >
                  <Ionicons name="settings" size={24} color={Colors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={[styles.profileSection, isDesktop && styles.profileSectionDesktop]}>
          <View style={styles.avatarContainer}>
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={[styles.avatarImage, isDesktop && styles.avatarImageDesktop]} />
            ) : (
              <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
                <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {user.nickname && (
            <Text style={styles.nickname}>{user.nickname}</Text>
          )}
          
          {fullName && (
            <Text style={styles.fullName}>{fullName}</Text>
          )}

          {(user.school || user.schoolType || user.department || user.class) && (
            <View style={styles.schoolInfoBox}>
              {user.school && (
                <View style={styles.schoolInfoRow}>
                  <Ionicons name="school" size={18} color={Colors.primary} />
                  <Text style={styles.schoolInfoText}>
                    {user.school} {getSchoolTypeText() && `• ${getSchoolTypeText()}`}
                  </Text>
                </View>
              )}
              {user.schoolType === 'üniversite' && user.department && (
                <View style={styles.schoolInfoRow}>
                  <Ionicons name="library" size={18} color={Colors.primary} />
                  <Text style={styles.schoolInfoText}>{user.department}</Text>
                </View>
              )}
              {user.class && (
                <View style={styles.schoolInfoRow}>
                  <Ionicons name="people" size={18} color={Colors.primary} />
                  <Text style={styles.schoolInfoText}>
                    {user.class === 'mezun' ? 'Mezun' : 
                     user.class === 'hazırlık' ? 'Hazırlık' : 
                     `${user.class}. Sınıf`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{userNotes.length}</Text>
            <Text style={styles.statLabel}>Paylaşılan Not</Text>
          </View>
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => setShowTrustScoreModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{trustScore || user.trustScore || 0}</Text>
            <Text style={styles.statLabel}>Güven Puanı</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Notlarım</Text>
          {notesLoading ? (
            <View style={styles.emptyNotes}>
              <Text style={styles.emptyNotesText}>Yükleniyor...</Text>
            </View>
          ) : notesError ? (
            <View style={styles.emptyNotes}>
              <Ionicons name="alert-circle" size={48} color={Colors.error} />
              <Text style={[styles.emptyNotesText, styles.errorText]}>{notesError}</Text>
            </View>
          ) : userNotes.length > 0 ? (
            <View style={[styles.notesGrid, isDesktop && styles.notesGridDesktop]}>
              {userNotes.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.noteCard, isDesktop && styles.noteCardDesktop]}
                  onPress={() => navigation.navigate('NoteDetail', { noteId: note.id, note })}
                >
                <View style={styles.noteHeader}>
                  <Ionicons name="document-text" size={24} color={Colors.primary} />
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text style={styles.noteDate}>
                      {note.createdAt
                        ? new Date(note.createdAt).toLocaleDateString('tr-TR')
                        : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.noteDescription} numberOfLines={2}>
                  {note.description}
                </Text>
                <View style={styles.noteStats}>
                  <View style={styles.noteStat}>
                    <Ionicons name="heart" size={16} color={Colors.textSecondary} />
                    <Text style={styles.noteStatText}>{note.likesCount || 0}</Text>
                  </View>
                  <View style={styles.noteStat}>
                    <Ionicons name="chatbubble" size={16} color={Colors.textSecondary} />
                    <Text style={styles.noteStatText}>{note.commentsCount || 0}</Text>
                  </View>
                </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyNotes}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyNotesText}>Henüz not paylaşılmamış</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Güven Puanı Detay Modal */}
      <Modal
        visible={showTrustScoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTrustScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Güven Puanı Detayları</Text>
              <TouchableOpacity
                onPress={() => setShowTrustScoreModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalStatRow}>
                <View style={styles.modalStatItem}>
                  <Ionicons name="heart" size={32} color={Colors.error} />
                  <Text style={styles.modalStatNumber}>{trustScoreDetails.likes}</Text>
                  <Text style={styles.modalStatLabel}>Toplam Beğeni</Text>
                  <Text style={styles.modalStatPoints}>+{trustScoreDetails.likes} puan</Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
                  <Text style={styles.modalStatNumber}>{trustScoreDetails.trusts}</Text>
                  <Text style={styles.modalStatLabel}>Toplam Güven</Text>
                  <Text style={styles.modalStatPoints}>+{trustScoreDetails.trusts * 2} puan</Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalSummary}>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Paylaşılan Not Sayısı:</Text>
                  <Text style={styles.modalSummaryValue}>{trustScoreDetails.notes}</Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Toplam Puan:</Text>
                  <Text style={styles.modalSummaryValue}>{trustScore || user.trustScore || 0}</Text>
                </View>
              </View>

              <View style={styles.modalInfoBox}>
                <Text style={styles.modalInfoText}>
                  💡 Her beğeni 1 puan, her güven 2 puan değerindedir.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Şikayet Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowReportModal(false);
          setReportReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.reportModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şikayet Et</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Bu kullanıcıyı neden şikayet etmek istiyorsunuz? Lütfen şikayet nedeninizi detaylı olarak açıklayın.
              </Text>
              
              <TextInput
                style={styles.reportInput}
                placeholder="Şikayet nedeninizi yazın (en az 10 karakter)..."
                placeholderTextColor={Colors.textLight}
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowReportModal(false);
                    setReportReason('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonSubmit,
                    (!reportReason.trim() || reportReason.trim().length < 10) && styles.modalButtonDisabled,
                  ]}
                  onPress={handleSubmitReport}
                  disabled={!reportReason.trim() || reportReason.trim().length < 10}
                >
                  <Text style={styles.modalButtonSubmitText}>Şikayet Et</Text>
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
  containerDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
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
  scrollContentDesktop: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 20,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  backButton: {
    padding: 8,
  },
  settingsHeaderButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportHeaderButton: {
    padding: 8,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
    marginBottom: 16,
  },
  profileSectionDesktop: {
    borderRadius: 12,
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDesktop: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarImageDesktop: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarText: {
    color: Colors.surface,
    fontSize: 40,
    fontWeight: '600',
  },
  avatarTextDesktop: {
    fontSize: 48,
  },
  nickname: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  fullName: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  schoolInfoBox: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  schoolInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schoolInfoText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  reportModalContent: {
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    gap: 20,
  },
  modalStatRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-around',
  },
  modalStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  modalStatNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  modalStatPoints: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  modalSummary: {
    gap: 12,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSummaryLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalSummaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalInfoBox: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  modalInfoText: {
    fontSize: 13,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statDescription: {
    fontSize: 10,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  notesSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  notesGrid: {
    flexDirection: 'column',
  },
  notesGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  noteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noteCardDesktop: {
    width: '48%',
    marginBottom: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  noteDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  noteStats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noteStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteStatText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyNotes: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyNotesText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  settingsButton: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  reportButton: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 40,
  },
  reportInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
    marginTop: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalButtonSubmit: {
    backgroundColor: Colors.error,
  },
  modalButtonSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  modalDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
});

export default ProfileScreen;

