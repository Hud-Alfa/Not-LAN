import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { isAdmin } from '../utils/admin';

const AdminPanelScreen = ({ navigation }) => {
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

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (userIsAdmin) {
      const unsubscribe = loadReports();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [userIsAdmin, filter]);

  const checkAdminStatus = async () => {
    const admin = await isAdmin();
    if (!admin) {
      if (Platform.OS === 'web') {
        window.alert('Yetki Yok: Bu sayfaya erişim yetkiniz yok');
        navigation.goBack();
      } else {
        Alert.alert('Yetki Yok', 'Bu sayfaya erişim yetkiniz yok', [
          { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
      }
      return;
    }
    setUserIsAdmin(true);
  };

  const loadReports = () => {
    setLoading(true);
    let reportsQuery;

    try {
      // Index gereksinimini önlemek için tüm şikayetleri al, client-side'da filtrele
      reportsQuery = query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc')
      );
    } catch (error) {
      console.error('Error creating query:', error);
      const errorMsg = 'Şikayetler yüklenirken bir hata oluştu.';
      
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Hata', errorMsg);
      }
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onSnapshot(
      reportsQuery,
      async (snapshot) => {
        const reportsData = [];
        for (const reportDoc of snapshot.docs) {
          const reportData = reportDoc.data();
          
          // Eski şikayetlerde status olmayabilir, varsayılan olarak 'pending' yap
          if (!reportData.status) {
            reportData.status = 'pending';
          }
          
          const report = {
            id: reportDoc.id,
            ...reportData,
          };
          
          // Client-side filtreleme: Filtreye göre şikayetleri filtrele
          if (filter !== 'all' && report.status !== filter) {
            continue; // Bu şikayeti atla, listeye ekleme
          }

          // Kullanıcı bilgilerini al
          if (report.reportedUserId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', report.reportedUserId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                report.reportedUser = {
                  id: report.reportedUserId,
                  displayName:
                    userData.nickname ||
                    `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                    'Kullanıcı',
                  email: userData.email || '',
                };
              } else {
                report.reportedUser = {
                  id: report.reportedUserId,
                  displayName: 'Silinmiş Kullanıcı',
                  email: '',
                };
              }
            } catch (error) {
              console.error('Error loading user:', error);
              report.reportedUser = {
                id: report.reportedUserId,
                displayName: 'Bilinmeyen Kullanıcı',
                email: '',
              };
            }
          }

          // Şikayet eden kullanıcı bilgilerini al
          if (report.reporterUserId) {
            try {
              const reporterDoc = await getDoc(doc(db, 'users', report.reporterUserId));
              if (reporterDoc.exists()) {
                const reporterData = reporterDoc.data();
                report.reporterUser = {
                  id: report.reporterUserId,
                  displayName:
                    reporterData.nickname ||
                    `${reporterData.firstName || ''} ${reporterData.lastName || ''}`.trim() ||
                    'Kullanıcı',
                };
              } else {
                report.reporterUser = {
                  id: report.reporterUserId,
                  displayName: 'Silinmiş Kullanıcı',
                };
              }
            } catch (error) {
              console.error('Error loading reporter:', error);
              report.reporterUser = {
                id: report.reporterUserId,
                displayName: 'Bilinmeyen Kullanıcı',
              };
            }
          }

          reportsData.push(report);
        }
        setReports(reportsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading reports:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Şikayetler yüklenirken bir hata oluştu';
        
        // Index eksikliği hatası
        if (error.code === 'failed-precondition' || error.message?.includes('index')) {
          errorMessage = 'Firestore index eksik. Lütfen Firebase Console\'da gerekli index\'i oluşturun. Hata mesajındaki linki kullanabilirsiniz.';
        } else if (error.code === 'permission-denied') {
          errorMessage = 'Şikayetleri görüntüleme yetkiniz yok. Lütfen admin yetkilerinizi kontrol edin.';
        }
        
        if (Platform.OS === 'web') {
          window.alert('Hata: ' + errorMessage);
        } else {
          Alert.alert('Hata', errorMessage);
        }
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  };

  const handleApprove = async (report) => {
    // Web için confirm, mobil için Alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Bu şikayeti onaylamak istediğinizden emin misiniz? Onaylandığında kullanıcının güven puanından o nottan gelen tüm puanlar düşecek.'
      );
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Şikayeti Onayla',
        'Bu şikayeti onaylamak istediğinizden emin misiniz? Onaylandığında kullanıcının güven puanından o nottan gelen tüm puanlar düşecek.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Onayla',
            style: 'destructive',
            onPress: async () => {
              await performApprove(report);
            },
          },
        ]
      );
      return;
    }

    await performApprove(report);
  };

  const performApprove = async (report) => {
    setActionLoading(true);
    try {
      // Şikayeti onayla
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: auth.currentUser.uid,
      });

      // Eğer not şikayeti ise, o nottan gelen tüm puanları düş
      if (report.type === 'note' && report.reportedNoteId) {
        try {
          // Notu al
          const noteDoc = await getDoc(doc(db, 'notes', report.reportedNoteId));
          if (noteDoc.exists()) {
            const noteData = noteDoc.data();
            const likesCount = noteData.likesCount || 0;
            const trustCount = noteData.trustCount || 0;
            
            // Bu nottan gelen puanları hesapla: beğeni = 1 puan, güven = 2 puan
            const pointsFromNote = (likesCount * 1) + (trustCount * 2);
            
            // Kullanıcının güven puanından düş
            if (report.reportedUserId) {
              const userDoc = await getDoc(doc(db, 'users', report.reportedUserId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const currentTrustScore = userData.trustScore || 0;
                const newTrustScore = Math.max(0, currentTrustScore - pointsFromNote);

                await updateDoc(doc(db, 'users', report.reportedUserId), {
                  trustScore: newTrustScore,
                });
              }
            }
          }
        } catch (error) {
          console.error('Error processing note report:', error);
        }
      } else if (report.type === 'user' && report.reportedUserId) {
        // Kullanıcı şikayeti için 5 puan düş
        const userDoc = await getDoc(doc(db, 'users', report.reportedUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentTrustScore = userData.trustScore || 0;
          const newTrustScore = Math.max(0, currentTrustScore - 5);

          await updateDoc(doc(db, 'users', report.reportedUserId), {
            trustScore: newTrustScore,
          });
        }
      }

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Şikayet onaylandı ve güven puanı düşürüldü');
      } else {
        Alert.alert('Başarılı', 'Şikayet onaylandı ve güven puanı düşürüldü');
      }
      setShowDetailModal(false);
      setSelectedReport(null);
      // Onaylanan filtresine geç
      setFilter('approved');
    } catch (error) {
      console.error('Error approving report:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: Şikayet onaylanırken bir hata oluştu - ' + error.message);
      } else {
        Alert.alert('Hata', 'Şikayet onaylanırken bir hata oluştu');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (report) => {
    // Web için confirm, mobil için Alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bu şikayeti reddetmek istediğinizden emin misiniz?');
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Şikayeti Reddet',
        'Bu şikayeti reddetmek istediğinizden emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Reddet',
            style: 'destructive',
            onPress: async () => {
              await performReject(report);
            },
          },
        ]
      );
      return;
    }

    await performReject(report);
  };

  const performReject = async (report) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: auth.currentUser.uid,
      });

      if (Platform.OS === 'web') {
        window.alert('Başarılı! Şikayet reddedildi');
      } else {
        Alert.alert('Başarılı', 'Şikayet reddedildi');
      }
      setShowDetailModal(false);
      setSelectedReport(null);
      // Reddedilen filtresine geç
      setFilter('rejected');
    } catch (error) {
      console.error('Error rejecting report:', error);
      if (Platform.OS === 'web') {
        window.alert('Hata: Şikayet reddedilirken bir hata oluştu - ' + error.message);
      } else {
        Alert.alert('Hata', 'Şikayet reddedilirken bir hata oluştu');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'approved':
        return Colors.error;
      case 'rejected':
        return Colors.textSecondary;
      default:
        return Colors.textLight;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Beklemede';
      case 'approved':
        return 'Onaylandı';
      case 'rejected':
        return 'Reddedildi';
      default:
        return 'Bilinmeyen';
    }
  };

  if (!userIsAdmin) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <StatusBar style="dark" />
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Paneli</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={[styles.mainScrollView, isWeb && styles.mainScrollViewWeb]} 
        contentContainerStyle={[styles.mainScrollContent, isWeb && styles.mainScrollContentWeb]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Arama Çubuğu */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Şikayet ara (neden, kullanıcı adı, e-posta)..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <Ionicons name="close-circle" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtreler */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filters}
        >
          <TouchableOpacity
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
              Beklemede
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'approved' && styles.filterButtonActive]}
            onPress={() => setFilter('approved')}
          >
            <Text style={[styles.filterText, filter === 'approved' && styles.filterTextActive]}>
              Onaylanan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'rejected' && styles.filterButtonActive]}
            onPress={() => setFilter('rejected')}
          >
            <Text style={[styles.filterText, filter === 'rejected' && styles.filterTextActive]}>
              Reddedilen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Tümü</Text>
          </TouchableOpacity>
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>Şikayet bulunamadı</Text>
          </View>
        ) : (
          <View style={styles.reportsContainer}>
            {(() => {
              const filteredReports = reports.filter((report) => {
                if (!searchQuery.trim()) return true;
                
                const query = searchQuery.toLowerCase().trim();
                const reason = (report.reason || '').toLowerCase();
                const reportedUserName = (report.reportedUser?.displayName || '').toLowerCase();
                const reportedUserEmail = (report.reportedUser?.email || '').toLowerCase();
                const reporterUserName = (report.reporterUser?.displayName || '').toLowerCase();
                const type = report.type === 'user' ? 'kullanıcı' : 'not';
                
                return (
                  reason.includes(query) ||
                  reportedUserName.includes(query) ||
                  reportedUserEmail.includes(query) ||
                  reporterUserName.includes(query) ||
                  type.includes(query)
                );
              });

              if (filteredReports.length === 0) {
                return (
                  <View style={styles.emptyContainer}>
                    <Ionicons 
                      name={searchQuery.trim() ? "search-outline" : "document-text-outline"} 
                      size={64} 
                      color={Colors.textLight} 
                    />
                    <Text style={styles.emptyText}>
                      {searchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Şikayet bulunamadı'}
                    </Text>
                    {searchQuery.trim() && (
                      <Text style={styles.emptySubtext}>"{searchQuery}" için sonuç yok</Text>
                    )}
                  </View>
                );
              }

              return filteredReports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportCard}
                  onPress={() => {
                    setSelectedReport(report);
                    setShowDetailModal(true);
                  }}
                >
                  <View style={styles.reportHeader}>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportType}>
                        {report.type === 'user' ? '👤 Kullanıcı Şikayeti' : '📄 Not Şikayeti'}
                      </Text>
                      <Text style={styles.reportDate}>
                        {report.createdAt
                          ? new Date(report.createdAt).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(report.status || 'pending') },
                      ]}
                    >
                      <Text style={styles.statusText}>{getStatusText(report.status || 'pending')}</Text>
                    </View>
                  </View>
                  <Text style={styles.reportReason} numberOfLines={2}>
                    {report.reason || 'Neden belirtilmemiş'}
                  </Text>
                  {report.reportedUser && (
                    <Text style={styles.reportedUser}>
                      Şikayet Edilen: {report.reportedUser.displayName}
                    </Text>
                  )}
                </TouchableOpacity>
              ));
            })()}
          </View>
        )}
      </ScrollView>

      {/* Detay Modal */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDetailModal(false);
          setSelectedReport(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReport && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Şikayet Detayı</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDetailModal(false);
                      setSelectedReport(null);
                    }}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Şikayet Türü</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.type === 'user' ? 'Kullanıcı Şikayeti' : 'Not Şikayeti'}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Şikayet Nedeni</Text>
                    <Text style={styles.detailValue}>{selectedReport.reason || 'Neden belirtilmemiş'}</Text>
                  </View>

                  {selectedReport.reportedUser && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Şikayet Edilen Kullanıcı</Text>
                      <Text style={styles.detailValue}>
                        {selectedReport.reportedUser.displayName}
                      </Text>
                      {selectedReport.reportedUser.email && (
                        <Text style={styles.detailSubValue}>{selectedReport.reportedUser.email}</Text>
                      )}
                    </View>
                  )}

                  {selectedReport.reporterUser && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Şikayet Eden Kullanıcı</Text>
                      <Text style={styles.detailValue}>
                        {selectedReport.reporterUser.displayName}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Tarih</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.createdAt
                        ? new Date(selectedReport.createdAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </Text>
                  </View>

                  {selectedReport.status && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Durum</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(selectedReport.status) },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {getStatusText(selectedReport.status)}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {selectedReport.status === 'pending' && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(selectedReport)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.rejectButtonText}>Reddet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(selectedReport)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color={Colors.surface} />
                      ) : (
                        <Text style={styles.approveButtonText}>Onayla</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerDesktop: {
    padding: 20,
    paddingTop: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  filtersContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    maxHeight: 60,
  },
  filters: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.surface,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 8,
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollViewWeb: {
    ...(Platform.OS === 'web' ? {
      height: '100%',
      maxHeight: 'calc(100vh - 140px)',
      overflowY: 'auto',
      overflowX: 'hidden',
    } : {}),
  },
  mainScrollContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  mainScrollContentWeb: {
    ...(Platform.OS === 'web' ? {
      minHeight: 'auto',
    } : {}),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  reportsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportInfo: {
    flex: 1,
  },
  reportType: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.surface,
  },
  reportReason: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  reportedUser: {
    fontSize: 12,
    color: Colors.textLight,
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
    maxWidth: 600,
    maxHeight: '80%',
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
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  detailSubValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  approveButton: {
    backgroundColor: Colors.error,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
});

export default AdminPanelScreen;

