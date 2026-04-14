import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './constants/Colors';
import { ActivityIndicator, View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SidebarNavigation from './components/SidebarNavigation';
import ResponsiveLayout from './components/ResponsiveLayout';
import SettingsDrawer from './components/SettingsDrawer';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import NoteDetailScreen from './screens/NoteDetailScreen';
import UploadNoteScreen from './screens/UploadNoteScreen';
import ChatListScreen from './screens/ChatListScreen';
import NewChatScreen from './screens/NewChatScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import AdminPanelScreen from './screens/AdminPanelScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack (Login/Register)
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      // Web: stack varsayılanında CardContent "page" (minHeight 100%) kullanılıyor;
      // kök 100vh + iç ScrollView birlikte tekerlek/sürükle kaydırmayı bozuyor.
      // modal → her zaman card (flex:1 + overflow:hidden) → iç ScrollView sınırlanır.
      ...Platform.select({ web: { presentation: 'modal' } }),
      contentStyle: {
        flex: 1,
        // Web: iç içe flex’te min-height:auto kaydırmayı kırar
        ...Platform.select({ web: { minHeight: 0 } }),
      },
    }}
    initialRouteName="Login"
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen
      name="Register"
      component={RegisterScreen}
      options={{
        // Geri kaydırma jesti ile ScrollView dikey kaydırması çakışmasın (Register 2. ekran)
        gestureEnabled: false,
      }}
    />
  </Stack.Navigator>
);

// Main Tab Navigator
const MainTabs = () => {
  const insets = useSafeAreaInsets();
  let width = 0;
  try {
    const dimensions = useWindowDimensions();
    width = dimensions.width;
  } catch (e) {
    // Web'de useWindowDimensions sorun çıkarabilir
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      width = window.innerWidth;
    }
  }
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;
  const tabBarHeight = 60 + Math.max(insets.bottom - 8, 0);
  
  return (
    <View style={styles.mainContainer}>
      {isDesktop && <SidebarNavigation />}
      <View style={[styles.contentArea, isDesktop && styles.contentAreaWithSidebar]}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Upload') {
                iconName = focused ? 'add-circle' : 'add-circle-outline';
              } else if (route.name === 'Chats') {
                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person' : 'person-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textSecondary,
            tabBarStyle: {
              backgroundColor: Colors.surface,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0),
              paddingTop: 8,
              height: tabBarHeight,
              elevation: 8,
              shadowColor: Colors.shadow,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              display: isDesktop ? 'none' : 'flex',
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
              marginBottom: Platform.OS === 'android' ? Math.max(insets.bottom - 8, 0) : 0,
            },
            headerShown: false,
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
          <Tab.Screen
            name="Upload"
            component={UploadNoteScreen}
            options={{ title: 'Not Ekle' }}
          />
          <Tab.Screen name="Chats" component={ChatListScreen} options={{ title: 'Sohbetler' }} />
          <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
        </Tab.Navigator>
      </View>
    </View>
  );
};

// Main App Stack
const AppStack = ({ navigationRef: navRef }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  let width = 0;
  try {
    const dimensions = useWindowDimensions();
    width = dimensions.width;
  } catch (e) {
    // Web'de useWindowDimensions sorun çıkarabilir
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      width = window.innerWidth;
    }
  }
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;

  // Settings drawer'ı açmak için global fonksiyon
  const openSettingsDrawer = () => {
    if (isDesktop) {
      setSettingsOpen(true);
    }
  };

  // Navigation container'a ref ekle ve global olarak erişilebilir yap
  useEffect(() => {
    if (isDesktop) {
      // Global settings açma fonksiyonunu window'a ekle (sadece web için)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.openSettingsDrawer = openSettingsDrawer;
      }
      return () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          delete window.openSettingsDrawer;
        }
      };
    }
  }, [isDesktop]);


  return (
    <View style={styles.appContainer}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          presentation: isDesktop ? 'card' : 'card',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="NoteDetail" component={NoteDetailScreen} />
        <Stack.Screen name="NewChat" component={NewChatScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        {!isDesktop && <Stack.Screen name="Settings" component={SettingsScreen} />}
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
      </Stack.Navigator>
      
      {/* Web için Settings Drawer */}
      {isDesktop && (
        <SettingsDrawer 
          isOpen={settingsOpen} 
          onClose={() => {
            setSettingsOpen(false);
          }} 
        />
      )}
    </View>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const navigationRef = useRef();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          // Kullanıcının Firestore'da olup olmadığını kontrol et (silinmiş kullanıcı kontrolü)
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
              // Kullanıcı silinmiş, çıkış yap
              await signOut(auth);
              setUser(null);
            } else {
              setUser(user);
            }
          } catch (error) {
            console.error('Error checking user:', error);
            // Hata durumunda da çıkış yap (güvenlik için)
            await signOut(auth);
            setUser(null);
          }
        } else {
          setUser(null);
        }
        if (initializing) setInitializing(false);
      },
      (error) => {
        console.error('Auth state error:', error);
        setUser(null);
        if (initializing) setInitializing(false);
      }
    );

    return unsubscribe;
  }, []);

  // İlk yüklemede auth state kontrolü tamamlanana kadar loading göster
  if (initializing) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.appWrapper}>
        <NavigationContainer ref={navigationRef} style={styles.navigationRoot}>
          {user ? <AppStack navigationRef={navigationRef} /> : <AuthStack />}
        </NavigationContainer>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    ...Platform.select({
      web: {
        minHeight: 0,
        height: '100vh',
        maxHeight: '100vh',
      },
    }),
  },
  navigationRoot: {
    flex: 1,
    ...Platform.select({
      web: { minHeight: 0 },
    }),
  },
  appWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
    ...Platform.select({
      web: {
        width: '100%',
        height: '100%',
        minHeight: 0,
        maxHeight: '100%',
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  appContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        flexDirection: 'row',
      },
    }),
  },
  mainContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        flexDirection: 'row',
      },
    }),
  },
  contentArea: {
    flex: 1,
  },
  contentAreaWithSidebar: {
    marginLeft: 250,
    ...Platform.select({
      web: {
        width: 'calc(100% - 250px)',
      },
    }),
  },
});
