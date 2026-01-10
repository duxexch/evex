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

export default function DepositScreen({ navigation }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setAmount('');
    setPaymentMethod('');
    setNotes('');
    setErrors({});
  };

  const confirmSubmit = () => {
    Alert.alert(
      i18n.t('confirm'),
      `Confirm deposit of ${amount} SAR?`,
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { text: i18n.t('confirm'), onPress: handleSubmit },
      ]
    );
  };

  const handleSubmit = async () => {
    const newErrors = {};
    
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!paymentMethod) {
      newErrors.paymentMethod = 'Please enter payment method';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.DEPOSIT, {
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        notes: notes,
      });
      Alert.alert(
        i18n.t('success'),
        i18n.t('request_submitted') + '\n\nYour deposit request has been received and will be processed within 24 hours.',
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
            <Text style={styles.infoTitle}>💰 {i18n.t('deposit_title')}</Text>
            <Text style={styles.infoText}>
              Enter the deposit amount and payment method details. Your request will be reviewed within 24 hours.
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

            <Text style={styles.label}>{i18n.t('payment_method')} *</Text>
            <TextInput
              style={[styles.input, isRTL() && styles.inputRTL, errors.paymentMethod && styles.inputError]}
              placeholder={i18n.t('select_payment_method')}
              placeholderTextColor={Colors.textMuted}
              value={paymentMethod}
              onChangeText={(text) => {
                setPaymentMethod(text);
                setErrors({ ...errors, paymentMethod: null });
              }}
              textAlign={isRTL() ? 'right' : 'left'}
              editable={!loading}
            />
            {errors.paymentMethod ? <Text style={styles.errorText}>{errors.paymentMethod}</Text> : null}

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
                <ActivityIndicator color={Colors.background} />
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
    borderColor: Colors.success,
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
    backgroundColor: Colors.success,
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
