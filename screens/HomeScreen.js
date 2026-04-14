import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import NoteCard from './NoteCard';
import ResponsiveLayout from '../components/ResponsiveLayout';

const HomeScreen = ({ navigation }) => {
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
  const isTablet = isWeb && width >= 768 && width < 1024;
  
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSchoolType, setFilterSchoolType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [hoveredSchoolType, setHoveredSchoolType] = useState(null);
  const [categoryFilterExpanded, setCategoryFilterExpanded] = useState(true);
  const [schoolTypeFilterExpanded, setSchoolTypeFilterExpanded] = useState(true);

  const categories = [
    { id: 'all', name: 'Tümü' },
    { id: 'matematik&fen', name: 'Matematik & Fen' },
    { id: 'sosyal bilimler', name: 'Sosyal Bilimler' },
    { id: 'teknoloji', name: 'Teknoloji' },
    { id: 'sanat&tasarım', name: 'Sanat & Tasarım' },
    { id: 'dil&edebiyat', name: 'Dil & Edebiyat' },
    { id: 'iş&ekonomi', name: 'İş & Ekonomi' },
    { id: 'sağlık&tıp', name: 'Sağlık & Tıp' },
    { id: 'hukuk', name: 'Hukuk' },
    { id: 'mühendislik', name: 'Mühendislik' },
    { id: 'mimarlık', name: 'Mimarlık' },
    { id: 'diğer', name: 'Diğer' },
  ];

  const schoolTypes = [
    { id: 'all', name: 'Tümü' },
    { id: 'ortaokul', name: 'Ortaokul' },
    { id: 'lise', name: 'Lise' },
    { id: 'üniversite', name: 'Üniversite' },
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'notes'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const notesData = [];
        snapshot.forEach((doc) => {
          if (doc.exists()) {
            notesData.push({ id: doc.id, ...doc.data() });
          }
        });
        setNotes(notesData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching notes:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = notes;

    // Kategori filtresi
    if (filterCategory !== 'all') {
      filtered = filtered.filter((note) => {
        // Yeni format: categories array içinde arıyoruz
        if (note.categories && Array.isArray(note.categories)) {
          return note.categories.includes(filterCategory);
        }
        // Eski format: category string (geriye dönük uyumluluk)
        return note.category === filterCategory;
      });
    }

    // Okul türü filtresi
    if (filterSchoolType !== 'all') {
      filtered = filtered.filter((note) => {
        // Önce targetSchoolType'a bak (notun hedeflediği okul türü)
        if (note.targetSchoolType) {
          return note.targetSchoolType === filterSchoolType;
        }
        // Eğer targetSchoolType yoksa, kullanıcının okul türüne bak
        const userInfo = note.userInfo || {};
        const schoolType = userInfo.schoolType || '';
        return schoolType === filterSchoolType;
      });
    }

    // Arama filtresi - başlık, açıklama ve kullanıcı adında ara
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((note) => {
        const userInfo = note.userInfo || {};
        const displayName = (userInfo.nickname || 
          `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 
          'Kullanıcı').toLowerCase();
        
        return (
          note.title.toLowerCase().includes(searchLower) ||
          note.description.toLowerCase().includes(searchLower) ||
          displayName.includes(searchLower)
        );
      });
    }

    setFilteredNotes(filtered);
  }, [searchQuery, filterCategory, filterSchoolType, notes]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Data will be refreshed by the snapshot listener
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderNoteCard = ({ item }) => (
    <NoteCard item={item} navigation={navigation} categories={categories} />
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <StatusBar style="dark" />
      {!isDesktop && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Not-Lan</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Not ara..."
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {isDesktop && (
        <View style={styles.desktopHeader}>
          <Text style={styles.desktopHeaderTitle}>Not-Lan</Text>
          <View style={styles.desktopSearchContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.desktopSearchInput}
              placeholder="Not ara..."
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {isWeb ? (
        <View style={styles.webFilterSection}>
          <View style={styles.webFilterContainer}>
            <TouchableOpacity
              style={styles.webFilterHeader}
              onPress={() => setCategoryFilterExpanded(!categoryFilterExpanded)}
            >
              <Text style={styles.webFilterTitle}>Kategoriler</Text>
              <Ionicons
                name={categoryFilterExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            {categoryFilterExpanded && (
              <View style={styles.webCategoryGrid}>
                {categories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.webFilterChip,
                      filterCategory === item.id && styles.webFilterChipActive,
                      hoveredCategory === item.id && filterCategory !== item.id && styles.webFilterChipHovered,
                    ]}
                    onPress={() => setFilterCategory(item.id)}
                    onMouseEnter={() => isWeb && setHoveredCategory(item.id)}
                    onMouseLeave={() => isWeb && setHoveredCategory(null)}
                  >
                    <Text
                      style={[
                        styles.webFilterChipText,
                        filterCategory === item.id && styles.webFilterChipTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={styles.webFilterContainer}>
            <TouchableOpacity
              style={styles.webFilterHeader}
              onPress={() => setSchoolTypeFilterExpanded(!schoolTypeFilterExpanded)}
            >
              <Text style={styles.webFilterTitle}>Okul Türü</Text>
              <Ionicons
                name={schoolTypeFilterExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            {schoolTypeFilterExpanded && (
              <View style={styles.webSchoolTypeRow}>
                {schoolTypes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.webFilterChip,
                      filterSchoolType === item.id && styles.webFilterChipActive,
                      hoveredSchoolType === item.id && filterSchoolType !== item.id && styles.webFilterChipHovered,
                    ]}
                    onPress={() => setFilterSchoolType(item.id)}
                    onMouseEnter={() => isWeb && setHoveredSchoolType(item.id)}
                    onMouseLeave={() => isWeb && setHoveredSchoolType(null)}
                  >
                    <Text
                      style={[
                        styles.webFilterChipText,
                        filterSchoolType === item.id && styles.webFilterChipTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.filterContainer}>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterCategory === item.id && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterCategory(item.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterCategory === item.id && styles.filterChipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            />
          </View>
          <View style={styles.filterContainer}>
            <FlatList
              horizontal
              data={schoolTypes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterSchoolType === item.id && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterSchoolType(item.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterSchoolType === item.id && styles.filterChipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            />
          </View>
        </>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          renderItem={({ item }) => <NoteCard item={item} navigation={navigation} categories={categories} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            isDesktop && styles.listContentDesktop,
            isTablet && styles.listContentTablet,
          ]}
          numColumns={isDesktop ? 2 : 1}
          columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>Henüz not paylaşılmamış</Text>
            </View>
          }
        />
      )}
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
    backgroundColor: Colors.surface,
    padding: 16,
    paddingTop: 50,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  desktopHeader: {
    backgroundColor: Colors.surface,
    padding: 20,
    paddingTop: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desktopHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  desktopSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 400,
  },
  desktopSearchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  filterContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.surface,
  },
  webFilterSection: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    gap: 20,
  },
  webFilterContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    paddingBottom: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  webFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  webFilterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  webCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  webSchoolTypeRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 16,
  },
  webFilterChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  webFilterChipHovered: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primaryLighter,
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  webFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    ...Platform.select({
      web: {
        transform: 'translateY(-2px)',
      },
    }),
  },
  webFilterChipText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  webFilterChipTextActive: {
    color: Colors.surface,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  listContentDesktop: {
    padding: 20,
    paddingHorizontal: 20,
  },
  listContentTablet: {
    padding: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
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
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLighter,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
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

export default HomeScreen;

