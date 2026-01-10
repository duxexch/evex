import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import api from '../services/api';
import { API_ENDPOINTS } from '../constants/config';
import i18n, { isRTL } from '../i18n';

export default function WithdrawScreen({ navigation }) {
  const [amount, setAmount] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setAmount('');
    setAccountDetails('');
    setNotes('');
    setErrors({});
  };

  const confirmSubmit = () => {
    Alert.alert(
      i18n.t('confirm'),
      `⚠️ Confirm withdrawal of ${amount} SAR?\n\nPlease verify your account details are correct.`,
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { text: i18n.t('confirm'), style: 'destructive', onPress: handleSubmit },
      ]
    );
  };

  const handleSubmit = async () => {
    const newErrors = {};
    
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!accountDetails) {
      newErrors.accountDetails = 'Please enter account details';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.WITHDRAW, {
        amount: parseFloat(amount),
        account_details: accountDetails,
        notes: notes,
      });
      Alert.alert(
        i18n.t('success'),
        i18n.t('request_submitted') + '\n\nYour withdrawal request will be processed within 48 hours.',
        [
          { text: 'View Transactions', onPress: () => navigation.navigate('MainTabs', { screen: 'Transactions' }) },
          { text: 'Back to Home', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }), style: 'cancel' },
        ]
      );
      resetForm();
    } catch (error) {
      Alert.alert(i18n.t('error'), error.response?.data?.detail || i18n.t('request_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Instructions */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💸 {i18n.t('withdraw_title')}</Text>
            <Text style={styles.infoText}>
              Enter the withdrawal amount and bank account details. Your request will be processed within 48 hours.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>{i18n.t('amount')} *</Text>
            <TextInput
              style={[styles.input, isRTL() && styles.inputRTL, errors.amount && styles.inputError]}
              placeholder={i18n.t('enter_amount')}
              placeholderTextColor={Colors.textMuted}
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setErrors({ ...errors, amount: null });
              }}
              keyboardType="decimal-pad"
              textAlign={isRTL() ? 'right' : 'left'}
              editable={!loading}
            />
            {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}

            <Text style={styles.label}>{i18n.t('account_details')} *</Text>
            <TextInput
              style={[styles.input, styles.textArea, isRTL() && styles.inputRTL, errors.accountDetails && styles.inputError]}
              placeholder="Bank name, account number, IBAN..."
              placeholderTextColor={Colors.textMuted}
              value={accountDetails}
              onChangeText={(text) => {
                setAccountDetails(text);
                setErrors({ ...errors, accountDetails: null });
              }}
              multiline
              numberOfLines={3}
              textAlign={isRTL() ? 'right' : 'left'}
              editable={!loading}
            />
            {errors.accountDetails ? <Text style={styles.errorText}>{errors.accountDetails}</Text> : null}

            <Text style={styles.label}>{i18n.t('notes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, isRTL() && styles.inputRTL]}
              placeholder="Optional notes"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlign={isRTL() ? 'right' : 'left'}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={confirmSubmit}
              disabled={loading}
              accessible={true}
              accessibilityLabel={i18n.t('submit')}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.buttonText}>{i18n.t('submit')}</Text>
              )}
            </TouchableOpacity>
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
  content: {
    padding: Spacing.lg,
  },
  infoCard: {
    backgroundColor: Colors.cardBackground,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderLeftWidth: 4,
  },
  infoTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  form: {
    marginTop: Spacing.md,
  },
  label: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  inputRTL: {
    textAlign: 'right',
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSizes.sm,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: Colors.danger,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
});
