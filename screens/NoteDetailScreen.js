import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { auth } from '../firebase/config';
import CustomButton from '../components/CustomButton';

const NoteDetailScreen = ({ route, navigation }) => {
  const { noteId, note: initialNote } = route?.params || {};
  const [note, setNote] = useState(initialNote || {});
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [userProfileImage, setUserProfileImage] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    loadComments();
    
    const userId = auth.currentUser?.uid;
    
    // Real-time not güncellemeleri (beğeni ve güven sayıları için)
    const unsubscribeNote = onSnapshot(doc(db, 'notes', noteId), async (noteDoc) => {
      if (noteDoc.exists()) {
        const noteData = { id: noteDoc.id, ...noteDoc.data() };
        setNote(noteData);
        
        // Dosya URL'ini al
        if (noteData.filePath && !fileUrl) {
          getDownloadURL(ref(storage, noteData.filePath))
            .then((url) => setFileUrl(url))
            .catch((err) => {
              // Dosya yoksa hata vermesin
              if (err.code !== 'storage/object-not-found') {
                console.error('Error loading file URL:', err);
              }
            });
        }
        
        // Kullanıcı profil fotoğrafını al
        if (noteData.userId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', noteData.userId));
            if (userDoc.exists() && userDoc.data().profileImage) {
              setUserProfileImage(userDoc.data().profileImage);
            }
          } catch (err) {
            console.error('Error loading user profile image:', err);
          }
        }
      }
    });

    // Real-time beğeni kontrolü
    if (userId) {
      const likesQuery = query(
        collection(db, 'likes'),
        where('noteId', '==', noteId),
        where('userId', '==', userId)
      );
      const unsubscribeLikes = onSnapshot(likesQuery, (snapshot) => {
        setLiked(!snapshot.empty);
      }, (error) => {
        console.error('Error listening to likes:', error);
      });

      // Real-time güven kontrolü
      const trustsQuery = query(
        collection(db, 'trusts'),
        where('noteId', '==', noteId),
        where('userId', '==', userId)
      );
      const unsubscribeTrusts = onSnapshot(trustsQuery, (snapshot) => {
        setTrusted(!snapshot.empty);
      }, (error) => {
        console.error('Error listening to trusts:', error);
      });

      return () => {
        if (unsubscribeNote) unsubscribeNote();
        if (unsubscribeLikes) unsubscribeLikes();
        if (unsubscribeTrusts) unsubscribeTrusts();
      };
    }

    return () => {
      if (unsubscribeNote) unsubscribeNote();
    };
  }, [noteId]);


  const loadComments = () => {
    // Index gerektirmemek için orderBy kullanmıyoruz, client-side'da sıralıyoruz
    const commentsQuery = query(
      collection(db, 'comments'),
      where('noteId', '==', noteId)
    );

    const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
      const commentsData = [];
      const allComments = [];
      
      // Önce tüm yorumları al
      snapshot.forEach((docSnap) => {
        allComments.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      // Client-side'da createdAt'e göre sırala
      allComments.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
      
      // Ana yorumları (parentCommentId olmayan veya null olan) filtrele
      const mainComments = allComments.filter(
        (comment) => !comment.parentCommentId || comment.parentCommentId === null
      );
      
      // Her ana yorum için cevapları bul
      for (const comment of mainComments) {
        const replies = allComments
          .filter((c) => c.parentCommentId === comment.id)
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateA - dateB;
          });
        comment.replies = replies;
        commentsData.push(comment);
      }
      
      setComments(commentsData);
    }, (error) => {
      console.error('Error loading comments:', error);
      // Index hatası durumunda sadece log'la, uygulamayı çökertme
    });

    return unsubscribe;
  };


  const handleLike = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      if (Platform.OS === 'web') {
        window.alert('Bu işlem için giriş yapmanız gerekiyor');
      } else {
        Alert.alert('Giriş Gerekli', 'Bu işlem için giriş yapmanız gerekiyor');
      }
      return;
    }

    // Kendi notuna beğeni veremez
    if (note?.userId === userId) {
      if (Platform.OS === 'web') {
        window.alert('Kendi notunuza beğeni veremezsiniz');
      } else {
        Alert.alert('Bilgi', 'Kendi notunuza beğeni veremezsiniz');
      }
      return;
    }

    try {
      const noteRef = doc(db, 'notes', noteId);
      
      if (liked) {
        // Beğeniyi kaldır
        const likesQuery = query(
          collection(db, 'likes'),
          where('noteId', '==', noteId),
          where('userId', '==', userId)
        );
        const likesSnapshot = await getDocs(likesQuery);
        const deletePromises = [];
        likesSnapshot.forEach((likeDoc) => {
          deletePromises.push(deleteDoc(likeDoc.ref));
        });
        await Promise.all(deletePromises);
        
        // Atomik olarak 1 azalt
        const currentLikesCount = note?.likesCount || 0;
        const newLikesCount = Math.max(0, currentLikesCount - 1);
        await updateDoc(noteRef, { likesCount: newLikesCount });
        
        // Optimistic update - state'i hemen güncelle
        setNote(prev => prev ? { ...prev, likesCount: newLikesCount } : null);
      } else {
        // Beğeni ekle
        await addDoc(collection(db, 'likes'), {
          noteId,
          userId,
          noteOwnerId: note.userId, // Güven puanı hesaplaması için
          createdAt: new Date().toISOString(),
        });
        
        // Atomik olarak 1 artır
        const currentLikesCount = note?.likesCount || 0;
        const newLikesCount = currentLikesCount + 1;
        await updateDoc(noteRef, { likesCount: newLikesCount });
        
        // Optimistic update - state'i hemen güncelle
        setNote(prev => prev ? { ...prev, likesCount: newLikesCount } : null);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      if (Platform.OS === 'web') {
        window.alert('Beğeni işlemi sırasında bir hata oluştu: ' + error.message);
      } else {
        Alert.alert('Hata', 'Beğeni işlemi sırasında bir hata oluştu: ' + error.message);
      }
    }
  };

  const handleTrust = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      if (Platform.OS === 'web') {
        window.alert('Bu işlem için giriş yapmanız gerekiyor');
      } else {
        Alert.alert('Giriş Gerekli', 'Bu işlem için giriş yapmanız gerekiyor');
      }
      return;
    }

    // Kendi notuna güven veremez
    if (note?.userId === userId) {
      if (Platform.OS === 'web') {
        window.alert('Kendi notunuza güven oyu veremezsiniz');
      } else {
        Alert.alert('Bilgi', 'Kendi notunuza güven oyu veremezsiniz');
      }
      return;
    }

    try {
      const noteRef = doc(db, 'notes', noteId);
      
      if (trusted) {
        // Güveni kaldır
        const trustsQuery = query(
          collection(db, 'trusts'),
          where('noteId', '==', noteId),
          where('userId', '==', userId)
        );
        const trustsSnapshot = await getDocs(trustsQuery);
        const deletePromises = [];
        trustsSnapshot.forEach((trustDoc) => {
          deletePromises.push(deleteDoc(trustDoc.ref));
        });
        await Promise.all(deletePromises);
        
        // Atomik olarak 1 azalt
        const currentTrustCount = note?.trustCount || 0;
        const newTrustCount = Math.max(0, currentTrustCount - 1);
        await updateDoc(noteRef, { trustCount: newTrustCount });
        
        // Optimistic update - state'i hemen güncelle
        setNote(prev => prev ? { ...prev, trustCount: newTrustCount } : null);
      } else {
        // Güven ekle
        await addDoc(collection(db, 'trusts'), {
          noteId,
          userId,
          noteOwnerId: note.userId, // Güven puanı hesaplaması için
          createdAt: new Date().toISOString(),
        });
        
        // Atomik olarak 1 artır
        const currentTrustCount = note?.trustCount || 0;
        const newTrustCount = currentTrustCount + 1;
        await updateDoc(noteRef, { trustCount: newTrustCount });
        
        // Optimistic update - state'i hemen güncelle
        setNote(prev => prev ? { ...prev, trustCount: newTrustCount } : null);
      }
    } catch (error) {
      console.error('Error toggling trust:', error);
      if (Platform.OS === 'web') {
        window.alert('Güven işlemi sırasında bir hata oluştu: ' + error.message);
      } else {
        Alert.alert('Hata', 'Güven işlemi sırasında bir hata oluştu: ' + error.message);
      }
    }
  };

  const handleAddComment = async () => {
    const commentText = replyingTo ? replyText : newComment;
    if (!commentText.trim()) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Giriş Gerekli', 'Yorum yapmak için giriş yapmanız gerekiyor');
      return;
    }

    setLoading(true);
    try {
      // Kullanıcı bilgilerini al
      let userInfo = {};
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userInfo = {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            nickname: userData.nickname || '',
          };
        }
      } catch (err) {
        console.error('Error loading user info:', err);
      }

      await addDoc(collection(db, 'comments'), {
        noteId,
        userId,
        userInfo,
        text: commentText.trim(),
        parentCommentId: replyingTo || null,
        createdAt: new Date().toISOString(),
      });

      // Yorum sayısını artır
      await updateDoc(doc(db, 'notes', noteId), {
        commentsCount: increment(1),
      });

      if (replyingTo) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Hata', 'Yorum eklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (fileUrl) {
      try {
        if (Platform.OS === 'web') {
          // Web'de yeni sekmede aç
          window.open(fileUrl, '_blank');
        } else {
          // Mobilde Linking kullan
          const supported = await Linking.canOpenURL(fileUrl);
          if (supported) {
            await Linking.openURL(fileUrl);
          } else {
            Alert.alert('Hata', 'Dosya açılamadı');
          }
        }
      } catch (error) {
        console.error('Download error:', error);
        if (Platform.OS === 'web') {
          window.alert('Dosya indirilemedi');
        } else {
          Alert.alert('Hata', 'Dosya indirilemedi');
        }
      }
    } else {
      if (Platform.OS === 'web') {
        window.alert('Dosya URL\'si bulunamadı');
      } else {
        Alert.alert('Bilgi', 'Dosya URL\'si bulunamadı');
      }
    }
  };

  const handleDeleteNote = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      if (Platform.OS === 'web') {
        window.alert('Bu işlem için giriş yapmanız gerekiyor');
      } else {
        Alert.alert('Giriş Gerekli', 'Bu işlem için giriş yapmanız gerekiyor');
      }
      return;
    }

    if (note?.userId !== userId) {
      if (Platform.OS === 'web') {
        window.alert('Sadece kendi notlarınızı silebilirsiniz');
      } else {
        Alert.alert('Yetki Yok', 'Sadece kendi notlarınızı silebilirsiniz');
      }
      return;
    }

    const deleteNoteAction = async () => {
      setLoading(true);
      try {
              // Storage'dan dosyayı sil (dosya yoksa hata vermesin)
              if (note?.filePath) {
                try {
                  await deleteObject(ref(storage, note.filePath));
                } catch (err) {
                  // Dosya zaten silinmiş olabilir, bu normal
                  if (err.code !== 'storage/object-not-found') {
                    console.error('Error deleting file:', err);
                  }
                }
              }

              // İlişkili verileri temizle (likes, trusts, comments - tüm yorumlar ve cevapları)
              const [likesSnapshot, trustsSnapshot, commentsSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'likes'), where('noteId', '==', noteId))),
                getDocs(query(collection(db, 'trusts'), where('noteId', '==', noteId))),
                getDocs(query(collection(db, 'comments'), where('noteId', '==', noteId))),
              ]);

              const deletePromises = [];
              
              // Beğenileri sil (sadece kendi beğenilerini sil, diğerlerini silmeye çalışma)
              // Not: Firestore rules'da sadece beğenen kişi silebilir, bu yüzden hata alırsa devam et
              for (const docSnap of likesSnapshot.docs) {
                try {
                  await deleteDoc(docSnap.ref);
                } catch (err) {
                  // İzin hatası normal, devam et
                  if (err.code !== 'permission-denied') {
                    console.error('Error deleting like:', err);
                  }
                }
              }
              
              // Güvenleri sil (sadece kendi güvenlerini sil, diğerlerini silmeye çalışma)
              // Not: Firestore rules'da sadece güvenen kişi silebilir, bu yüzden hata alırsa devam et
              for (const docSnap of trustsSnapshot.docs) {
                try {
                  await deleteDoc(docSnap.ref);
                } catch (err) {
                  // İzin hatası normal, devam et
                  if (err.code !== 'permission-denied') {
                    console.error('Error deleting trust:', err);
                  }
                }
              }
              
              // Yorumları ve cevaplarını sil
              for (const commentDoc of commentsSnapshot.docs) {
                try {
                  deletePromises.push(deleteDoc(commentDoc.ref));
                  
                  // Bu yorumun cevaplarını da sil
                  const repliesQuery = query(
                    collection(db, 'comments'),
                    where('parentCommentId', '==', commentDoc.id)
                  );
                  const repliesSnapshot = await getDocs(repliesQuery);
                  repliesSnapshot.forEach((replyDoc) => {
                    deletePromises.push(deleteDoc(replyDoc.ref));
                  });
                } catch (err) {
                  console.error('Error deleting comment:', err);
                }
              }

              // Önce notu sil (böylece anında listeden kalkar)
              await deleteDoc(doc(db, 'notes', noteId));

              // Sonra ilişkili verileri sil (hata alırsa devam et)
              try {
                await Promise.all(deletePromises);
              } catch (err) {
                console.error('Error deleting related data:', err);
                // Bazı veriler silinememiş olabilir ama not silindi, devam et
              }

              // Not silindi, ana sayfaya dön (real-time güncelleme ile kart otomatik kalkacak)
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting note:', error);
              if (Platform.OS === 'web') {
                window.alert('Not silinirken bir hata oluştu: ' + error.message);
              } else {
                Alert.alert('Hata', 'Not silinirken bir hata oluştu: ' + error.message);
              }
            } finally {
              setLoading(false);
            }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bu notu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
        deleteNoteAction();
      }
    } else {
      Alert.alert(
        'Notu Sil',
        'Bu notu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: deleteNoteAction,
          },
        ]
      );
    }
  };

  const handleReportNote = () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Giriş Gerekli', 'Şikayet etmek için giriş yapmanız gerekiyor');
      return;
    }

    if (note?.userId === userId) {
      Alert.alert('Hata', 'Kendi notunuzu şikayet edemezsiniz');
      return;
    }

    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

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
        reportedNoteId: noteId,
        reportedUserId: note?.userId,
        reporterUserId: userId,
        type: 'note',
        reason: reportReason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Başarılı', 'Şikayetiniz alındı');
      setShowReportModal(false);
      setReportReason('');
    } catch (error) {
      console.error('Error reporting note:', error);
      Alert.alert('Hata', 'Şikayet gönderilirken bir hata oluştu');
    }
  };

  const userInfo = note?.userInfo || {};
  const displayName = userInfo.nickname || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Kullanıcı';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.userSection}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => {
                if (note?.userId) {
                  const currentUserId = auth.currentUser?.uid;
                  // Eğer tıklanan kullanıcı kendi kullanıcısı ise, userId parametresini gönderme
                  if (note.userId === currentUserId) {
                    navigation.navigate('Profile');
                  } else {
                    navigation.navigate('Profile', { userId: note.userId });
                  }
                }
              }}
              activeOpacity={0.7}
            >
              {userProfileImage ? (
                <Image source={{ uri: userProfileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => {
                if (note?.userId) {
                  const currentUserId = auth.currentUser?.uid;
                  // Eğer tıklanan kullanıcı kendi kullanıcısı ise, userId parametresini gönderme
                  if (note.userId === currentUserId) {
                    navigation.navigate('Profile');
                  } else {
                    navigation.navigate('Profile', { userId: note.userId });
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userDetails}>
                {userInfo.department || ''} {userInfo.class ? `• ${userInfo.class === 'mezun' ? 'Mezun' : userInfo.class === 'hazırlık' ? 'Hazırlık' : userInfo.class}` : ''}
              </Text>
              <Text style={styles.date}>
                {note?.createdAt ? new Date(note.createdAt).toLocaleDateString('tr-TR') : ''}
              </Text>
            </TouchableOpacity>
            <View style={styles.noteActions}>
              {note?.userId === auth.currentUser?.uid && (
                <TouchableOpacity
                  onPress={handleDeleteNote}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash" size={20} color={Colors.error} />
                </TouchableOpacity>
              )}
              {note?.userId && note?.userId !== auth.currentUser?.uid && (
                <TouchableOpacity
                  onPress={handleReportNote}
                  style={styles.reportButton}
                >
                  <Ionicons name="flag" size={20} color={Colors.warning} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.title}>{note?.title}</Text>
          <Text style={styles.description}>{note?.description}</Text>

          {note?.fileName && (
            <View style={styles.fileSection}>
              <View style={styles.filePreview}>
                <Ionicons name="document-text" size={24} color={Colors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>{note?.fileName || 'Dosya'}</Text>
              </View>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => {
                  if (fileUrl) {
                    if (Platform.OS === 'web') {
                      window.open(fileUrl, '_blank');
                    } else {
                      Linking.openURL(fileUrl);
                    }
                  } else {
                    if (Platform.OS === 'web') {
                      window.alert('Dosya yükleniyor, lütfen bekleyin');
                    } else {
                      Alert.alert('Bilgi', 'Dosya yükleniyor, lütfen bekleyin');
                    }
                  }
                }}
              >
                <Ionicons name="eye-outline" size={18} color={Colors.primary} />
                <Text style={styles.viewButtonText}>Görüntüle</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, liked && styles.actionButtonActive]}
              onPress={handleLike}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={24}
                color={liked ? Colors.error : Colors.textSecondary}
              />
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionText, liked && styles.actionTextActive]}>
                  {note?.likesCount || 0}
                </Text>
                <Text style={styles.actionLabel}>Beğeni</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, trusted && styles.actionButtonActive]}
              onPress={handleTrust}
            >
              <Ionicons
                name={trusted ? "shield" : "shield-outline"}
                size={24}
                color={trusted ? Colors.success : Colors.textSecondary}
              />
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionText, trusted && styles.actionTextActive]}>
                  {note?.trustCount || 0}
                </Text>
                <Text style={styles.actionLabel}>Güven</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Yorumlar ({comments.length})</Text>

          {comments.map((comment) => {
            const commentUser = comment.userInfo || {};
            const commentDisplayName = commentUser.nickname || 
              `${commentUser.firstName || ''} ${commentUser.lastName || ''}`.trim() || 'Kullanıcı';
            
            return (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {commentDisplayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentInfo}>
                    <Text style={styles.commentUserName}>{commentDisplayName}</Text>
                    <Text style={styles.commentDate}>
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('tr-TR') : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    style={styles.replyButton}
                  >
                    <Ionicons name="arrow-undo" size={16} color={Colors.primary} />
                    <Text style={styles.replyButtonText}>Cevap</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.commentText}>{comment.text}</Text>
                
                {/* Cevaplar */}
                {comment.replies && comment.replies.length > 0 && (
                  <View style={styles.repliesContainer}>
                    {comment.replies.map((reply) => {
                      const replyUser = reply.userInfo || {};
                      const replyDisplayName = replyUser.nickname || 
                        `${replyUser.firstName || ''} ${replyUser.lastName || ''}`.trim() || 'Kullanıcı';
                      return (
                        <View key={reply.id} style={styles.replyCard}>
                          <View style={styles.replyHeader}>
                            <View style={styles.replyAvatar}>
                              <Text style={styles.replyAvatarText}>
                                {replyDisplayName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.replyInfo}>
                              <Text style={styles.replyUserName}>{replyDisplayName}</Text>
                              <Text style={styles.replyDate}>
                                {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('tr-TR') : ''}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.replyText}>{reply.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                
                {/* Cevap yazma alanı */}
                {replyingTo === comment.id && (
                  <View style={styles.replyInputContainer}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Cevap yazın..."
                      placeholderTextColor={Colors.textLight}
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                    />
                    <View style={styles.replyActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        style={styles.cancelReplyButton}
                      >
                        <Text style={styles.cancelReplyText}>İptal</Text>
                      </TouchableOpacity>
                      <CustomButton
                        title="Gönder"
                        onPress={handleAddComment}
                        loading={loading}
                        disabled={!replyText.trim()}
                        style={styles.sendReplyButton}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.addCommentSection}>
            <TextInput
              style={styles.commentInput}
              placeholder="Yorum yazın..."
              placeholderTextColor={Colors.textLight}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <CustomButton
              title="Yorum Ekle"
              onPress={handleAddComment}
              loading={loading}
              disabled={!newComment.trim()}
              style={styles.commentButton}
            />
          </View>
        </View>
      </ScrollView>

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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notu Şikayet Et</Text>
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
                Bu notu neden şikayet etmek istiyorsunuz? Lütfen şikayet nedeninizi detaylı olarak açıklayın.
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
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      overflow: 'auto',
      maxHeight: '100vh',
    } : {}),
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userSection: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    color: Colors.surface,
    fontSize: 20,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
  reportButton: {
    padding: 8,
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
    maxWidth: 500,
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
  },
  modalDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
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
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  userDetails: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: Colors.textLight,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  fileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      userSelect: 'none',
    } : {}),
  },
  viewButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    gap: 8,
    flex: 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      userSelect: 'none',
    } : {}),
  },
  actionButtonActive: {
    backgroundColor: Colors.primaryLighter,
  },
  actionTextContainer: {
    alignItems: 'flex-start',
  },
  actionText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionTextActive: {
    color: Colors.primary,
  },
  actionLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  commentsSection: {
    marginTop: 8,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  commentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  commentInfo: {
    flex: 1,
  },
  commentUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  commentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  addCommentSection: {
    marginTop: 16,
  },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
    color: Colors.text,
  },
  commentButton: {
    alignSelf: 'flex-end',
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  replyButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 12,
    marginLeft: 48,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  replyCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  replyAvatarText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  replyInfo: {
    flex: 1,
  },
  replyUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  replyDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  replyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  replyInputContainer: {
    marginTop: 12,
    marginLeft: 48,
  },
  replyInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
    color: Colors.text,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelReplyButton: {
    padding: 8,
    justifyContent: 'center',
  },
  cancelReplyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sendReplyButton: {
    paddingHorizontal: 16,
  },
});

export default NoteDetailScreen;

