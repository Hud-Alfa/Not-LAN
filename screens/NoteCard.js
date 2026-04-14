import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const NoteCard = ({ item, navigation, categories }) => {
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
  
  const userInfo = item.userInfo || {};
  const displayName = userInfo.nickname || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Kullanıcı';
  const [profileImage, setProfileImage] = useState(null);

  // Profil fotoğrafını yükle
  useEffect(() => {
    if (item.userId) {
      getDoc(doc(db, 'users', item.userId))
        .then((userDoc) => {
          if (userDoc.exists() && userDoc.data().profileImage) {
            setProfileImage(userDoc.data().profileImage);
          }
        })
        .catch((err) => console.error('Error loading profile image:', err));
    }
  }, [item.userId]);

  return (
    <TouchableOpacity
      style={[styles.noteCard, isDesktop && styles.noteCardDesktop]}
      onPress={() => navigation.navigate('NoteDetail', { noteId: item.id, note: item })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userDetails}>
              {userInfo.department || ''} {userInfo.class ? `• ${userInfo.class}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {(() => {
              // Yeni format: categories array
              if (item.categories && Array.isArray(item.categories) && item.categories.length > 0) {
                const categoryNames = item.categories
                  .map(catId => categories.find((c) => c.id === catId)?.name || catId)
                  .join(', ');
                return categoryNames;
              }
              // Eski format: category string (geriye dönük uyumluluk)
              return categories.find((c) => c.id === item.category)?.name || item.category || 'Kategori yok';
            })()}
          </Text>
        </View>
      </View>

      <Text style={styles.noteTitle}>{item.title}</Text>
      <Text style={styles.noteDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.filePreview}>
          <Ionicons name="document-text" size={24} color={Colors.primary} />
          <Text style={styles.fileName}>{item.fileName || 'Dosya'}</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{item.likesCount || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{item.commentsCount || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 16,
    maxWidth: '48%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  userDetails: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLighter,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  noteDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

export default NoteCard;

