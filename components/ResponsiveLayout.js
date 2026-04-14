import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants/Colors';

const ResponsiveLayout = ({ children, style }) => {
  return (
    <View
      style={[
        styles.container,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    ...Platform.select({
      web: {
        width: '100%',
        height: '100%',
        minHeight: '100vh',
      },
    }),
  },
});

export default ResponsiveLayout;

