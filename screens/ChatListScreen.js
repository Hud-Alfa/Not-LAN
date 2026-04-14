import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { isAdmin } from '../utils/admin';

const ChatListScreen = ({ navigation }) => {
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
  
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatNames, setChatNames] = useState({}); // chatId -> displayName mapping
  const [chatProfileImages, setChatProfileImages] = useState({}); // chatId -> profileImage mapping
  const [unreadCounts, setUnreadCounts] = useState({}); // chatId -> unread count mapping

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Kullanıcının katıldığı sohbetleri al
    // orderBy kullanmıyoruz çünkü yeni sohbetlerde lastMessageTime olmayabilir
    // Client-side'da sıralama yapacağız
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const chatsData = [];
        const namesMap = {};
        
        for (const docSnap of snapshot.docs) {
          const chatData = { id: docSnap.id, ...docSnap.data() };
          
          // Güvenlik: Kullanıcı hala participant mı kontrol et
          // (Real-time update ile zaten filtrelenmiş olmalı ama ekstra güvenlik için)
          if (!chatData.participants || !chatData.participants.includes(userId)) {
            continue; // Bu sohbeti atla
          }
          
          // Sohbet silinmiş mi kontrol et (hiddenBy array'inde kullanıcı var mı?)
          const hiddenBy = chatData.hiddenBy || [];
          if (hiddenBy.includes(userId)) {
            continue; // Bu sohbeti atla (kullanıcı tarafından silinmiş)
          }
          
          // Tüm sohbetleri göster (mesaj olmasa bile)
          chatsData.push(chatData);
          
          // Grup sohbeti değilse, diğer katılımcının nickname'ini al (kendi hariç)
          if (!chatData.isGroup && chatData.participants) {
            const otherParticipants = chatData.participants.filter((p) => p !== userId);
            if (otherParticipants.length > 0) {
              try {
                const userDoc = await getDoc(doc(db, 'users', otherParticipants[0]));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  
                  // Admin kontrolü: Eğer diğer kullanıcı admin ise ve mevcut kullanıcı admin değilse, bu sohbeti gösterme
                  const otherIsAdmin = userData.isAdmin === true || userData.isAdmin === 'True' || userData.isAdmin === 'true';
                  const currentIsAdmin = await isAdmin();
                  
                  if (otherIsAdmin && !currentIsAdmin) {
                    continue; // Admin sohbetini atla
                  }
                  
                  const name = userData.nickname || 
                    `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 
                    'Kullanıcı';
                  namesMap[docSnap.id] = name;
                  // Profil fotoğrafını da kaydet
                  if (userData.profileImage) {
                    setChatProfileImages(prev => ({
                      ...prev,
                      [docSnap.id]: userData.profileImage
                    }));
                  }
                } else {
                  // Kullanıcı silinmiş - "Not-Lan Kullanıcısı" olarak göster
                  namesMap[docSnap.id] = 'Not-Lan Kullanıcısı';
                }
              } catch (err) {
                console.error('Error loading user:', err);
                // Hata durumunda da silinmiş kullanıcı olarak işaretle
                namesMap[docSnap.id] = 'Not-Lan Kullanıcısı';
              }
            } else {
              // Tek başına kaldıysa (diğer kullanıcı sohbeti silmiş)
              // Sohbeti gösterme, atla
              continue;
            }
          } else {
            // Grup sohbeti ise grup adını göster
            namesMap[docSnap.id] = chatData.name || `Grup Sohbeti ${docSnap.id.slice(0, 8)}`;
          }
        }
        
        // Sohbetleri sırala: lastMessageTime varsa ona göre, yoksa createdAt'e göre
        chatsData.sort((a, b) => {
          const timeA = a.lastMessageTime || a.createdAt || '';
          const timeB = b.lastMessageTime || b.createdAt || '';
          return timeB.localeCompare(timeA); // Descending order
        });
        
        setChats(chatsData);
        setChatNames(namesMap);
        
        // Okunmamış mesaj sayılarını hesapla
        loadUnreadCounts(chatsData, userId);
      },
      (error) => {
        // İzin hatası normal (kullanıcı sohbetten çıkmış olabilir), sessizce yoksay
        if (error.code !== 'permission-denied') {
          console.error('Error loading chats:', error);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Load unread message counts for each chat
  const loadUnreadCounts = async (chatsList, userId) => {
    if (!userId || chatsList.length === 0) return;
    
    // Tüm sohbetler için paralel olarak okunmamış mesaj sayılarını hesapla
    const promises = chatsList.map(async (chat) => {
      try {
        // Bu sohbetin tüm mesajlarını kontrol et
        const messagesQuery = query(
          collection(db, 'messages'),
          where('chatId', '==', chat.id)
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        let unreadCount = 0;
        
        // Son mesaj zamanını al
        const lastMessageTime = chat.lastMessageTime;
        
        if (lastMessageTime) {
          // Son mesaj zamanından sonra gelen ve kullanıcının gönderdiği olmayan mesajları say
          messagesSnapshot.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            // Başkalarının mesajları ve son mesaj zamanından sonra gelenler
            if (msgData.userId !== userId && 
                msgData.createdAt && 
                new Date(msgData.createdAt) > new Date(lastMessageTime)) {
              unreadCount++;
            }
          });
        } else {
          // Eğer lastMessageTime yoksa, kullanıcının gönderdiği olmayan tüm mesajları say
          messagesSnapshot.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            if (msgData.userId !== userId) {
              unreadCount++;
            }
          });
        }
        
        return { chatId: chat.id, count: unreadCount };
      } catch (error) {
        console.error('Error loading unread count for chat:', chat.id, error);
        return { chatId: chat.id, count: 0 };
      }
    });
    
    const results = await Promise.all(promises);
    const newCounts = {};
    results.forEach(({ chatId, count }) => {
      newCounts[chatId] = count;
    });
    
    setUnreadCounts(newCounts);
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      chat.name?.toLowerCase().includes(searchLower) ||
      chat.lastMessage?.toLowerCase().includes(searchLower)
    );
  });

  const renderChatItem = ({ item }) => {
    const displayName = chatNames[item.id] || item.name || `Sohbet ${item.id.slice(0, 8)}`;
    const isGroup = item.isGroup;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', { chatId: item.id, chat: item })}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          {isGroup ? (
            <Ionicons name="people" size={24} color={Colors.surface} />
          ) : chatProfileImages[item.id] ? (
            <Image
              source={{ uri: chatProfileImages[item.id] }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <View style={styles.chatNameContainer}>
              <Text style={styles.chatName} numberOfLines={1}>
                {displayName}
              </Text>
              {isGroup && (
                <Ionicons name="people" size={14} color={Colors.textSecondary} style={styles.groupIcon} />
              )}
            </View>
            {item.lastMessageTime && (
              <Text style={styles.chatTime}>
                {new Date(item.lastMessageTime).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || 'Henüz mesaj yok'}
          </Text>
        </View>
        <View style={styles.rightContainer}>
          {unreadCounts[item.id] > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCounts[item.id] > 99 ? '99+' : unreadCounts[item.id]}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <StatusBar style="dark" />
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <Text style={styles.headerTitle}>Sohbetler</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => navigation.navigate('NewChat')}
        >
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Sohbet ara..."
          placeholderTextColor={Colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>Henüz sohbet yok</Text>
            <Text style={styles.emptySubtext}>Yeni sohbet başlatmak için + butonuna tıklayın</Text>
          </View>
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    paddingTop: 50,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerDesktop: {
    padding: 20,
    paddingTop: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  newChatButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  listContent: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  groupIcon: {
    marginLeft: 6,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.textLight,
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
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
    textAlign: 'center',
  },
});

export default ChatListScreen;

