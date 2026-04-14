import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import SettingsScreen from '../screens/SettingsScreen';

const SettingsDrawer = ({ isOpen, onClose }) => {
  const navigation = useNavigation();
  const [slideAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isOpen) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Ayarlar</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.drawerContent}>
            <SettingsScreen navigation={navigation} isDrawer={true} onClose={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
      },
    }),
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    width: 400,
    height: '100%',
    backgroundColor: Colors.surface,
    ...Platform.select({
      web: {
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  drawerContent: {
    flex: 1,
    ...Platform.select({
      web: {
        overflow: 'auto',
      },
    }),
  },
});

export default SettingsDrawer;

