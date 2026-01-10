import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import authService from '../services/authService';
import i18n, { setLanguage, isRTL } from '../i18n';
import { AuthContext } from '../../App';

export default function ProfileScreen({ navigation }) {
  const { setIsAuthenticated } = useContext(AuthContext);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      i18n.t('logout'),
      'Are you sure you want to logout?',
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('logout'),
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            setIsAuthenticated(false);
            // Navigation reset will be handled by App.js auth state change
          },
        },
      ]
    );
  };

  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '---'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.first_name?.charAt(0) || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>
            {user?.first_name} {user?.last_name}
          </Text>
          <Text style={styles.customerCode}>
            {i18n.t('customer_code')}: {user?.customer_code}
          </Text>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('account_info')}</Text>
          <View style={styles.card}>
            <InfoRow label={i18n.t('phone_number')} value={user?.phone_number} />
            <InfoRow label={i18n.t('language')} value={user?.language_code?.toUpperCase()} />
            <InfoRow label={i18n.t('country')} value={user?.country_code} />
            <InfoRow
              label={i18n.t('notifications')}
              value={user?.notifications_enabled ? i18n.t('enabled') : i18n.t('disabled')}
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('settings')}</Text>
          <TouchableOpacity style={styles.settingItemDisabled} disabled>
            <Text style={styles.settingTextDisabled}>{i18n.t('change_language')}</Text>
            <Text style={styles.settingBadge}>Coming Soon</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItemDisabled} disabled>
            <Text style={styles.settingTextDisabled}>{i18n.t('change_country')}</Text>
            <Text style={styles.settingBadge}>Coming Soon</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItemDisabled} disabled>
            <Text style={styles.settingTextDisabled}>{i18n.t('toggle_notifications')}</Text>
            <Text style={styles.settingBadge}>Coming Soon</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            accessible={true}
            accessibilityLabel={i18n.t('logout')}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>{i18n.t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSizes.xxxl,
    fontWeight: 'bold',
    color: Colors.background,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  customerCode: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingItemDisabled: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  settingText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  settingTextDisabled: {
    fontSize: FontSizes.md,
    color: Colors.textMuted,
  },
  settingArrow: {
    fontSize: FontSizes.xl,
    color: Colors.textSecondary,
  },
  settingBadge: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    backgroundColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  logoutButton: {
    backgroundColor: Colors.danger,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
});
