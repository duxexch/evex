import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import i18n from '../i18n';
import authService from '../services/authService';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      // TODO: Fetch actual balance from API
      setBalance(0);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const ServiceCard = ({ title, icon, color, onPress, isPrimary }) => (
    <TouchableOpacity
      style={[
        styles.serviceCard,
        { borderLeftColor: color },
        isPrimary && styles.serviceCardPrimary,
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      <Text style={styles.serviceIcon}>{icon}</Text>
      <Text style={[styles.serviceTitle, isPrimary && styles.serviceTitlePrimary]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {i18n.t('welcome')} 👋
            </Text>
            <Text style={styles.userName}>
              {user?.first_name || 'User'}
            </Text>
          </View>
          <View style={styles.customerCodeBadge}>
            <Text style={styles.customerCodeLabel}>ID</Text>
            <Text style={styles.customerCode}>
              {user?.customer_code || '---'}
            </Text>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{i18n.t('total_balance')}</Text>
          {loadingBalance ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : (
            <Text style={styles.balanceAmount}>
              {balance.toFixed(2)} <Text style={styles.currency}>SAR</Text>
            </Text>
          )}
          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{i18n.t('available_balance')}</Text>
              <Text style={styles.statValue}>{balance.toFixed(2)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{i18n.t('locked_balance')}</Text>
              <Text style={styles.statValue}>0.00</Text>
            </View>
          </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.serviceGrid}>
            <ServiceCard
              title={i18n.t('deposit')}
              icon="💰"
              color={Colors.success}
              onPress={() => navigation.navigate('Deposit')}
              isPrimary={true}
            />
            <ServiceCard
              title={i18n.t('withdraw')}
              icon="💸"
              color={Colors.danger}
              onPress={() => navigation.navigate('Withdraw')}
              isPrimary={true}
            />
          </View>
          <View style={styles.serviceGrid}>
            <ServiceCard
              title={i18n.t('complaint')}
              icon="📨"
              color={Colors.warning}
              onPress={() => navigation.navigate('Complaint')}
            />
            <ServiceCard
              title={i18n.t('settings')}
              icon="⚙️"
              color={Colors.info}
              onPress={() => navigation.navigate('Profile')}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{i18n.t('no_transactions')}</Text>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  greeting: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  customerCodeBadge: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  customerCodeLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  customerCode: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  balanceCard: {
    backgroundColor: Colors.cardBackground,
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  balanceAmount: {
    fontSize: FontSizes.xxxl,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  currency: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  viewAll: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
  },
  serviceGrid: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  serviceCardPrimary: {
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serviceIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  serviceTitle: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  serviceTitlePrimary: {
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: Colors.cardBackground,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
