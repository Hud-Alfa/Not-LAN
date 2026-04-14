import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, addDoc, where, arrayUnion, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import CustomButton from '../components/CustomButton';
import { isAdmin } from '../utils/admin';

const NewChatScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.firstName?.toLowerCase().includes(searchLower) ||
            user.lastName?.toLowerCase().includes(searchLower) ||
            user.nickname?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower)
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'users'));
      const snapshot = await getDocs(usersQuery);
      const usersData = [];
      const currentUserId = auth.currentUser?.uid;
      
      if (!currentUserId) {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
        return;
      }
      
      const currentIsAdmin = await isAdmin();

      snapshot.forEach((doc) => {
        if (doc.id !== currentUserId) {
          const userData = doc.data();
          
          // Admin kontrolü: Eğer kullanıcı admin ise ve mevcut kullanıcı admin değilse, listeye ekleme
          const userIsAdmin = userData.isAdmin === true || userData.isAdmin === 'True' || userData.isAdmin === 'true';
          if (userIsAdmin && !currentIsAdmin) {
            return; // Admin kullanıcıyı atla
          }
          
          usersData.push({ id: doc.id, ...userData });
        }
      });

      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      
      let errorMessage = 'Kullanıcılar yüklenirken bir hata oluştu';
      
      if (error.code === 'permission-denied' || error.code === 'permissions-denied') {
        errorMessage = 'Kullanıcıları görüntüleme izniniz yok.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
      }
      
      Alert.alert('Hata', errorMessage);
    }
  };

  const toggleUserSelection = (userId) => {
    if (isGroupChat) {
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    } else {
      setSelectedUsers([userId]);
    }
  };

  const checkExistingChat = async (currentUserId, selectedUserId) => {
    try {
      // Sadece mevcut kullanıcının participants içinde olduğu sohbetleri kontrol et
      // (Firestore rules'a göre kullanıcı sadece kendi sohbetlerini okuyabilir)
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUserId),
        where('isGroup', '==', false)
      );
      
      const snapshot = await getDocs(chatsQuery);
      
      for (const docSnap of snapshot.docs) {
        try {
          const chatData = docSnap.data();
          const participants = chatData.participants || [];
          
          // Bu sohbet hem mevcut kullanıcıyı hem de seçilen kullanıcıyı içeriyor mu?
          // Ve sadece 2 kişi var mı? (bireysel sohbet)
          if (participants.includes(selectedUserId) && participants.length === 2) {
            // Sohbet var, hiddenBy'dan kaldır (eğer varsa)
            const hiddenBy = chatData.hiddenBy || [];
            if (hiddenBy.includes(currentUserId)) {
              try {
                await updateDoc(doc(db, 'chats', docSnap.id), {
                  hiddenBy: hiddenBy.filter((id) => id !== currentUserId),
                });
              } catch (updateError) {
                // Permission hatası olabilir, sessizce devam et
                if (updateError.code !== 'permission-denied' && updateError.code !== 'permissions-denied') {
                  console.error('Error updating hiddenBy:', updateError);
                }
              }
            }
            
            return { 
              exists: true, 
              chatId: docSnap.id, 
              chat: { id: docSnap.id, ...chatData, hiddenBy: hiddenBy.filter((id) => id !== currentUserId) } 
            };
          }
        } catch (docError) {
          // Tek bir doküman okuma hatası - devam et
          if (docError.code !== 'permission-denied' && docError.code !== 'permissions-denied') {
            console.error('Error reading chat document:', docError);
          }
          continue;
        }
      }
      
      // Sohbet bulunamadı
      return { exists: false };
    } catch (error) {
      // Permission hatası veya diğer hatalar - sessizce false döndür, yeni sohbet oluşturulsun
      // Permission hatası normal olabilir (kullanıcı henüz sohbet oluşturmamış olabilir)
      if (error.code !== 'permission-denied' && error.code !== 'permissions-denied') {
        console.error('Error checking existing chat:', error);
      }
      return { exists: false };
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir kullanıcı seçin');
      return;
    }

    if (isGroupChat) {
      if (!groupName.trim()) {
        Alert.alert('Hata', 'Lütfen grup adını girin');
        return;
      }
      if (selectedUsers.length < 1) {
        Alert.alert('Hata', 'Grup sohbeti için en az bir kullanıcı seçmelisiniz');
        return;
      }
    }

    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
      return;
    }

    try {
      // Bireysel sohbet için mevcut sohbet kontrolü (grup sohbeti değilse)
      if (!isGroupChat && selectedUsers.length === 1) {
        const existingChat = await checkExistingChat(currentUserId, selectedUsers[0]);
        
        if (existingChat.exists) {
          // Mevcut sohbeti aç
          navigation.replace('Chat', { 
            chatId: existingChat.chatId, 
            chat: existingChat.chat 
          });
          return;
        }
      }

      const participants = [currentUserId, ...selectedUsers];
      const chatData = {
        participants,
        isGroup: isGroupChat,
        name: isGroupChat ? groupName.trim() : null,
        createdAt: new Date().toISOString(),
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        hiddenBy: [], // Yeni sohbetlerde hiddenBy boş array
      };

      const chatDocRef = await addDoc(collection(db, 'chats'), chatData);

      // Sohbet oluşturuldu, sohbet ekranına git
      navigation.replace('Chat', { 
        chatId: chatDocRef.id, 
        chat: { id: chatDocRef.id, ...chatData } 
      });
    } catch (error) {
      console.error('Error creating chat:', error);
      
      // Daha açıklayıcı hata mesajları
      let errorMessage = 'Sohbet oluşturulurken bir hata oluştu';
      
      if (error.code === 'permission-denied' || error.code === 'permissions-denied') {
        errorMessage = 'Sohbet oluşturma izniniz yok. Lütfen giriş yaptığınızdan emin olun.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Hata', errorMessage);
    }
  };

  const renderUserItem = ({ item }) => {
    const displayName =
      item.nickname ||
      `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
      'Kullanıcı';
    const isSelected = selectedUsers.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.school && (
            <Text style={styles.userSchool}>
              {item.school} {item.department ? `• ${item.department}` : ''}
            </Text>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Sohbet</Text>
      </View>

      <View style={styles.optionsContainer}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Grup Sohbeti</Text>
          <Switch
            value={isGroupChat}
            onValueChange={setIsGroupChat}
            trackColor={{ false: Colors.border, true: Colors.primaryLighter }}
            thumbColor={isGroupChat ? Colors.primary : Colors.textLight}
          />
        </View>

        {isGroupChat && (
          <View style={styles.groupNameContainer}>
            <TextInput
              style={styles.groupNameInput}
              placeholder="Grup adı"
              placeholderTextColor={Colors.textLight}
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>
        )}

        {isGroupChat && selectedUsers.length > 0 && (
          <Text style={styles.selectedCount}>
            {selectedUsers.length} kullanıcı seçildi
          </Text>
        )}

        {selectedUsers.length > 0 && (!isGroupChat || groupName.trim()) && (
          <View style={styles.createButtonContainer}>
            <CustomButton
              title={isGroupChat ? "Grup Oluştur" : "Sohbet Başlat"}
              onPress={handleCreateChat}
              style={styles.createButton}
            />
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Kullanıcı ara (isim, e-posta, okul)..."
          placeholderTextColor={Colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>Kullanıcı bulunamadı</Text>
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
  header: {
    flexDirection: 'row',
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
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  optionsContainer: {
    backgroundColor: Colors.surface,
    padding: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  groupNameContainer: {
    marginTop: 16,
  },
  groupNameInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  selectedCount: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 12,
  },
  createButtonContainer: {
    marginTop: 16,
  },
  createButton: {
    width: '100%',
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
    paddingBottom: 100,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  userItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLighter,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.surface,
    fontSize: 20,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  userSchool: {
    fontSize: 12,
    color: Colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
});

export default NewChatScreen;

