import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { isAdmin } from '../utils/admin';

const ChatScreen = ({ route, navigation }) => {
  const { chatId, chat: initialChat } = route?.params || {};
  const currentUserId = auth.currentUser?.uid;

  // State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState(initialChat || {});
  const [chatDisplayName, setChatDisplayName] = useState('');
  const [chatProfileImage, setChatProfileImage] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [otherUserIsAdmin, setOtherUserIsAdmin] = useState(false);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [hasAdminMessage, setHasAdminMessage] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const unsubscribeMessages = useRef(null);
  const unsubscribeChat = useRef(null);
  const lastReadMessageId = useRef(null);

  // Initialize
  useEffect(() => {
    if (!chatId || !currentUserId) {
      navigation.goBack();
      return;
    }

    loadChat();
    loadMessages();

    return () => {
      if (unsubscribeMessages.current) unsubscribeMessages.current();
      if (unsubscribeChat.current) unsubscribeChat.current();
    };
  }, [chatId, currentUserId]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);


  // Check if admin has sent a message
  const checkAdminMessage = async (messagesData) => {
    if (!chat || chat.isGroup || !otherUserIsAdmin) {
      return;
    }

    // Check if any message is from the admin user
    const others = chat.participants?.filter((p) => p !== currentUserId) || [];
    if (others.length === 0) return;

    const adminUserId = others[0];
    const adminHasMessage = messagesData.some((msg) => msg.userId === adminUserId);
    setHasAdminMessage(adminHasMessage);
  };

  // Load chat details
  const loadChat = () => {
    if (!chatId) return;

    unsubscribeChat.current = onSnapshot(
      doc(db, 'chats', chatId),
      async (docSnap) => {
        if (!docSnap.exists()) {
          Alert.alert('Hata', 'Sohbet bulunamadı', [
            { text: 'Tamam', onPress: () => navigation.goBack() },
          ]);
          return;
        }

        const chatData = { id: docSnap.id, ...docSnap.data() };
        setChat(chatData);

        if (!chatData.participants?.includes(currentUserId)) {
          Alert.alert('Bilgi', 'Bu sohbet silindi.', [
            { text: 'Tamam', onPress: () => navigation.goBack({ screen: 'Chats' }) },
          ]);
          return;
        }


        await loadDisplayName(chatData);

        if (chatData.isGroup && chatData.participants) {
          loadParticipants(chatData.participants);
        }

        // Check if other user is admin (for non-group chats)
        if (!chatData.isGroup) {
          const others = chatData.participants?.filter((p) => p !== currentUserId) || [];
          if (others.length > 0) {
            const otherIsAdmin = await isAdmin(others[0]);
            setOtherUserIsAdmin(otherIsAdmin);
          }
        }
        
        // Check if current user is admin
        const userIsAdmin = await isAdmin();
        setCurrentUserIsAdmin(userIsAdmin);

        setLoading(false);
      },
      (error) => {
        // Permission hatası - sohbet silinmiş olabilir, sessizce handle et
        if (error.code === 'permission-denied' || error.code === 'permissions-denied') {
          // Sessizce sohbetler ekranına dön
          navigation.navigate('MainTabs', { screen: 'Chats' });
        } else {
          console.error('Error loading chat:', error);
        }
        setLoading(false);
      }
    );
  };

  // Load display name
  const loadDisplayName = async (chatData) => {
    if (chatData.isGroup) {
      setChatDisplayName(chatData.name || 'Grup Sohbeti');
      setOtherUserId(null);
      return;
    }

    const others = chatData.participants?.filter((p) => p !== currentUserId) || [];
    if (others.length === 0) {
      setChatDisplayName('Sohbet');
      setOtherUserId(null);
      return;
    }

    // Diğer kullanıcının ID'sini sakla
    setOtherUserId(others[0]);

    try {
      const userDoc = await getDoc(doc(db, 'users', others[0]));
      if (userDoc.exists()) {
        const user = userDoc.data();
        
        // Admin kontrolü: Eğer diğer kullanıcı admin ise ve mevcut kullanıcı admin değilse, profil yönlendirmesini engelle
        const userIsAdmin = user.isAdmin === true || user.isAdmin === 'True' || user.isAdmin === 'true';
        const currentUserIsAdmin = await isAdmin();
        
        if (userIsAdmin && !currentUserIsAdmin) {
          // Admin profiline gidilemez, ama sohbet devam edebilir
          setOtherUserId(null);
        } else {
          setOtherUserId(others[0]);
        }
        
        const name =
          user.nickname ||
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          'Kullanıcı';
        setChatDisplayName(name);
        setChatProfileImage(user.profileImage || null);
      } else {
        // Kullanıcı hesabı silinmiş
        setChatDisplayName('Not-Lan Kullanıcısı');
        setOtherUserId(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setChatDisplayName('Kullanıcı');
      setOtherUserId(null);
    }
  };

  // Load participants
  const loadParticipants = async (participantIds) => {
    try {
      const data = [];
      for (const id of participantIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', id));
          if (userDoc.exists()) {
            const user = userDoc.data();
            data.push({
              id,
              nickname: user.nickname || '',
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              profileImage: user.profileImage || '',
            });
          }
        } catch (err) {
          console.error('Error loading participant:', err);
        }
      }
      setParticipants(data);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  // Load messages with real-time updates
  const loadMessages = () => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId)
    );

    unsubscribeMessages.current = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => {
          if (doc.exists()) {
            data.push({ id: doc.id, ...doc.data() });
          }
        });

        // Sort by createdAt
        data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });

        setMessages(data);
        setLoading(false);

        // Check admin message status (only if other user is admin)
        if (chat && !chat.isGroup && otherUserIsAdmin) {
          checkAdminMessage(data);
        }

        // Mark messages as delivered when they arrive
        markAsDelivered(data);
      },
      (error) => {
        console.error('Error loading messages:', error);
        setLoading(false);
      }
    );
  };

  // Mark messages as delivered (WhatsApp: double gray tick)
  const markAsDelivered = async (messagesList) => {
    if (!currentUserId || !chatId) return;

    try {
      const others = chat?.participants?.filter((p) => p !== currentUserId) || [];
      if (others.length === 0) return;

      const undelivered = messagesList.filter(
        (msg) =>
          msg.userId !== currentUserId && // Not my messages
          !(msg.deliveredTo || []).includes(currentUserId) // Not yet delivered to me
      );

      if (undelivered.length === 0) return;

      // Mark as delivered
      const updates = undelivered.map((msg) =>
        updateDoc(doc(db, 'messages', msg.id), {
          deliveredTo: [...(msg.deliveredTo || []), currentUserId],
          status: 'delivered',
        })
      );

      await Promise.all(updates);
    } catch (error) {
      // Silently handle permission errors
      if (error.code !== 'permission-denied' && error.code !== 'permissions-denied') {
        console.error('Error marking as delivered:', error);
      }
    }
  };


  // Send message
  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || sending) return;

    if (!currentUserId) {
      Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
      return;
    }

    if (!chat?.participants?.includes(currentUserId)) {
      Alert.alert('Hata', 'Bu sohbette değilsiniz');
      return;
    }

    // Admin kontrolü: Eğer karşı taraf admin ise ve admin henüz mesaj atmamışsa, kullanıcı mesaj atamaz
    if (!currentUserIsAdmin && otherUserIsAdmin && !hasAdminMessage) {
      Alert.alert('Mesaj Gönderilemez', 'Admin kullanıcı size mesaj göndermeden önce siz mesaj gönderemezsiniz');
      return;
    }

    setSending(true);
    const messageText = text;
    setNewMessage('');

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      let userInfo = {};
      if (userDoc.exists()) {
        const user = userDoc.data();
        userInfo = {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          nickname: user.nickname || '',
          profileImage: user.profileImage || '',
        };
      }

      // Get other participants for deliveredTo
      const others = chat?.participants?.filter((p) => p !== currentUserId) || [];
      
      // Create message with initial status
      const messageRef = await addDoc(collection(db, 'messages'), {
        chatId,
        userId: currentUserId,
        userInfo,
        text: messageText,
        deliveredTo: others, // Mark as delivered to all other participants
        status: 'delivered', // sent, delivered
        createdAt: new Date().toISOString(),
      });

      // Update chat with last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: messageText,
        lastMessageTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Hata', 'Mesaj gönderilemedi');
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // Delete chat (WhatsApp style - hide from list but keep in database)
  const deleteChat = async () => {
    if (!currentUserId || !chatId) return;

    try {
      // Kullanıcıyı hiddenBy array'ine ekle (sohbet listeden gizlenecek ama participants'ta kalacak)
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const hiddenBy = chatData.hiddenBy || [];
        
        if (!hiddenBy.includes(currentUserId)) {
          await updateDoc(doc(db, 'chats', chatId), {
            hiddenBy: [...hiddenBy, currentUserId],
          });
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }

    // Always show success message and navigate to chats screen
    Alert.alert('Bilgi', 'Sohbet silindi');
    navigation.navigate('MainTabs', { screen: 'Chats' });
  };

  // Message Avatar Component - kullanıcının güncel profil fotoğrafını çeker
  const MessageAvatar = ({ userId, profileImage, name, onPress }) => {
    const [currentProfileImage, setCurrentProfileImage] = useState(
      profileImage && profileImage.trim() !== '' ? profileImage : null
    );

    useEffect(() => {
      // Eğer mesajdaki profileImage yoksa veya boşsa, Firestore'dan güncel profil fotoğrafını çek
      if ((!profileImage || profileImage.trim() === '') && userId) {
        const fetchProfileImage = async () => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const img = userData.profileImage;
              if (img && typeof img === 'string' && img.trim() !== '') {
                setCurrentProfileImage(img);
              }
            }
          } catch (error) {
            console.error('Error fetching profile image:', error);
          }
        };
        fetchProfileImage();
      } else if (profileImage && profileImage.trim() !== '') {
        setCurrentProfileImage(profileImage);
      }
    }, [userId, profileImage]);

    return (
      <TouchableOpacity
        style={styles.avatar}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {currentProfileImage ? (
          <Image
            source={{ uri: currentProfileImage }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Get message status icon (WhatsApp style)
  const getMessageStatusIcon = (message) => {
    if (message.userId !== currentUserId) return null; // Only show status for own messages

    const deliveredTo = message.deliveredTo || [];
    const others = chat?.participants?.filter((p) => p !== currentUserId) || [];

    if (others.length === 0) return null; // No other participants

    // At least all have received it (double gray tick) - İLETİLDİ
    // deliveredTo array'inde tüm diğer kullanıcılar var mı kontrol et
    const allDelivered = others.every((userId) => deliveredTo.includes(userId));
    if (allDelivered && deliveredTo.length >= others.length) {
      return { name: 'checkmark-done', color: Colors.textSecondary };
    }

    // At least one has received it (single gray tick) - GÖNDERİLDİ
    if (deliveredTo.length > 0) {
      return { name: 'checkmark', color: Colors.textSecondary };
    }

    // Sending (clock icon) - GÖNDERİLİYOR
    return { name: 'time-outline', color: Colors.textLight };
  };

  // Render message
  const renderMessage = useCallback(
    ({ item }) => {
      const isMine = item.userId === currentUserId;
      const user = item.userInfo || {};
      const name =
        user.nickname ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        'Kullanıcı';

      const statusIcon = getMessageStatusIcon(item);
      
      // Profil fotoğrafını kontrol et - userInfo'da varsa onu kullan, yoksa boş string kontrolü yap
      const profileImage = user.profileImage && user.profileImage.trim() !== '' ? user.profileImage : null;

      return (
        <View
          style={[
            styles.messageRow,
            isMine ? styles.messageRowRight : styles.messageRowLeft,
          ]}
        >
          {!isMine && (
            <MessageAvatar
              userId={item.userId}
              profileImage={profileImage}
              name={name}
              onPress={() => {
                // Mesaj gönderenin profil sayfasına git
                if (item.userId && item.userId !== currentUserId) {
                  navigation.navigate('Profile', { userId: item.userId });
                }
              }}
            />
          )}
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleRight : styles.bubbleLeft,
            ]}
          >
            {!isMine && <Text style={styles.senderName}>{name}</Text>}
            <Text
              style={[styles.messageText, isMine && styles.messageTextRight]}
            >
              {item.text}
            </Text>
            <View style={styles.footer}>
              <Text style={[styles.time, isMine && styles.timeRight]}>
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  : ''}
              </Text>
              {isMine && statusIcon && (
                <Ionicons
                  name={statusIcon.name}
                  size={14}
                  color={statusIcon.color}
                  style={styles.readIcon}
                />
              )}
            </View>
          </View>
        </View>
      );
    },
    [currentUserId, chat]
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  const displayName = chatDisplayName || chat?.name || 'Sohbet';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => {
            if (chat?.isGroup) {
              setShowParticipantsModal(true);
            } else if (otherUserId) {
              // Bireysel sohbetlerde profile git
              navigation.navigate('Profile', { userId: otherUserId });
            }
          }}
          activeOpacity={0.7}
        >
          {!chat?.isGroup && chatProfileImage && (
            <Image
              source={{ uri: chatProfileImage }}
              style={styles.headerAvatar}
            />
          )}
          <Text style={styles.headerTitle}>{displayName}</Text>
          {chat?.isGroup && (
            <Text style={styles.headerSubtitle}>
              {chat.participants?.length || 0} katılımcı
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowDeleteModal(true)}
          style={styles.deleteBtn}
        >
          <Ionicons
            name={chat?.isGroup ? 'exit-outline' : 'trash-outline'}
            size={24}
            color={Colors.error}
          />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {Platform.OS === 'web' ? (
        <View style={styles.messagesArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={64} color={Colors.textLight} />
                <Text style={styles.emptyText}>Henüz mesaj yok</Text>
                <Text style={styles.emptySubtext}>İlk mesajı siz gönderin!</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.messagesArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={64} color={Colors.textLight} />
                <Text style={styles.emptyText}>Henüz mesaj yok</Text>
                <Text style={styles.emptySubtext}>İlk mesajı siz gönderin!</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />
        </KeyboardAvoidingView>
      )}

      {/* Input */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder={
            !currentUserIsAdmin && otherUserIsAdmin && !hasAdminMessage
              ? 'Admin size mesaj göndermeden önce mesaj gönderemezsiniz'
              : 'Mesaj yazın...'
          }
          placeholderTextColor={Colors.textLight}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
          editable={!sending && (currentUserIsAdmin || !otherUserIsAdmin || hasAdminMessage)}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            ((!newMessage.trim() || sending) || (!currentUserIsAdmin && otherUserIsAdmin && !hasAdminMessage)) &&
              styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={
            !newMessage.trim() ||
            sending ||
            (!currentUserIsAdmin && otherUserIsAdmin && !hasAdminMessage)
          }
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.surface} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={newMessage.trim() ? Colors.surface : Colors.textLight}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Delete Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {chat?.isGroup ? 'Gruptan Çık' : 'Sohbeti Sil'}
            </Text>
            <Text style={styles.modalText}>
              {chat?.isGroup
                ? 'Bu gruptan çıkmak istediğinizden emin misiniz?'
                : 'Bu sohbeti silmek istediğinizden emin misiniz?'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDelete]}
                onPress={() => {
                  setShowDeleteModal(false);
                  deleteChat();
                }}
              >
                <Text style={styles.modalBtnDeleteText}>
                  {chat?.isGroup ? 'Çık' : 'Sil'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Participants Modal */}
      <Modal
        visible={showParticipantsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.participantsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Katılımcılar</Text>
              <TouchableOpacity
                onPress={() => setShowParticipantsModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={participants}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const name =
                  item.nickname ||
                  `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
                  'Kullanıcı';
                return (
                  <TouchableOpacity
                    style={styles.participantRow}
                    onPress={() => {
                      // Katılımcının profil sayfasına git
                      if (item.id && item.id !== currentUserId) {
                        navigation.navigate('Profile', { userId: item.id });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.participantAvatar}>
                      {item.profileImage ? (
                        <Image
                          source={{ uri: item.profileImage }}
                          style={styles.participantAvatarImg}
                        />
                      ) : (
                        <Text style={styles.participantAvatarText}>
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.participantName}>{name}</Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.participantsList}
            />
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
    ...(Platform.OS === 'web' ? {
      height: '100vh',
      maxHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      justifyContent: 'flex-start',
    } : {}),
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  messagesArea: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      minHeight: 0,
      overflow: 'auto',
      flexShrink: 1,
      flexBasis: 0,
    } : {}),
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    color: Colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRight: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleLeft: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text,
  },
  messageTextRight: {
    color: Colors.surface,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  time: {
    fontSize: 11,
    opacity: 0.65,
    color: Colors.textSecondary,
  },
  timeRight: {
    color: Colors.surface,
    opacity: 0.85,
  },
  readIcon: {
    marginLeft: 2,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 10 : Platform.OS === 'web' ? 12 : 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...(Platform.OS === 'web' ? {
      position: 'relative',
      zIndex: 1000,
      flexShrink: 0,
      flexGrow: 0,
      minHeight: 60,
      width: '100%',
      display: 'flex',
      marginTop: 'auto',
    } : {
      paddingBottom: 40,
      marginTop: -4,
    }),
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 44,
    color: Colors.text,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.backgroundDark,
    opacity: 0.5,
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
    padding: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalBtnDelete: {
    backgroundColor: Colors.error,
  },
  modalBtnDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  participantsModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    padding: 4,
  },
  participantsList: {
    padding: 16,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  participantAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  participantAvatarText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  participantName: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
});

export default ChatScreen;
