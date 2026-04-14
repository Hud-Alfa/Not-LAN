import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { useNavigation, useRoute, useNavigationState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { auth } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdmin } from '../utils/admin';

const SidebarNavigation = () => {
  const navigation = useNavigation();
  const route = useRoute();
  let navigationState = null;
  try {
    navigationState = useNavigationState(state => state);
  } catch (e) {
    console.warn('Navigation state error:', e);
  }
  const [user, setUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(userData);
            setProfileImage(userData.profileImage);
            const admin = await isAdmin();
            setUserIsAdmin(admin);
          }
        } catch (error) {
          console.error('Error loading user:', error);
        }
      }
    };
    loadUser();
  }, []);

  const displayName = user?.nickname || 
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 
    'Kullanıcı';

  const navItems = [
    { name: 'Home', label: 'Ana Sayfa', icon: 'home', route: 'MainTabs' },
    { name: 'Upload', label: 'Not Ekle', icon: 'add-circle', route: 'MainTabs' },
    { name: 'Chats', label: 'Sohbetler', icon: 'chatbubbles', route: 'MainTabs' },
    { name: 'Profile', label: 'Profil', icon: 'person', route: 'MainTabs' },
  ];

  const handleNavPress = (item) => {
    if (item.route === 'MainTabs') {
      navigation.navigate('MainTabs', { screen: item.name });
    } else {
      navigation.navigate(item.route);
    }
  };

  const isActive = (item) => {
    if (!navigationState) return false;
    
    const currentRouteName = navigationState.routes[navigationState.index]?.name;
    
    if (currentRouteName === 'MainTabs') {
      const tabState = navigationState.routes[navigationState.index]?.state;
      const tabRoute = tabState?.routes[tabState?.index]?.name;
      return tabRoute === item.name;
    }
    return currentRouteName === item.name || currentRouteName === item.route;
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.logo}>Not-Lan</Text>
      </View>

      <View style={styles.navItems}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[styles.navItem, isActive(item) && styles.navItemActive]}
            onPress={() => handleNavPress(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive(item) ? item.icon : `${item.icon}-outline`}
              size={24}
              color={isActive(item) ? Colors.primary : Colors.text}
            />
            <Text
              style={[
                styles.navItemText,
                isActive(item) && styles.navItemTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
        {userIsAdmin && (
          <TouchableOpacity
            style={[styles.navItem, isActive({ name: 'AdminPanel', route: 'AdminPanel' }) && styles.navItemActive]}
            onPress={() => navigation.navigate('AdminPanel')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive({ name: 'AdminPanel', route: 'AdminPanel' }) ? 'shield' : 'shield-outline'}
              size={24}
              color={isActive({ name: 'AdminPanel', route: 'AdminPanel' }) ? Colors.primary : Colors.text}
            />
            <Text
              style={[
                styles.navItemText,
                isActive({ name: 'AdminPanel', route: 'AdminPanel' }) && styles.navItemTextActive,
              ]}
            >
              Admin Paneli
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sidebarFooter}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
          activeOpacity={0.7}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.profileSubtext}>Profilini Görüntüle</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: 20,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        zIndex: 1000,
      },
      default: {
        height: '100%',
      },
    }),
  },
  sidebarHeader: {
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  navItems: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  navItemActive: {
    backgroundColor: Colors.primaryLighter,
  },
  navItemText: {
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
  navItemTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  profileSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default SidebarNavigation;

