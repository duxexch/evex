import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/theme';
import authService from '../services/authService';
import i18n, { isRTL } from '../i18n';
import { AuthContext } from '../../App';

export default function RegisterScreen({ navigation }) {
  const { setIsAuthenticated } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    firstName: '',
    lastName: '',
    languageCode: 'ar',
    countryCode: 'SA',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    
    if (!formData.phoneNumber || !formData.firstName) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.phoneNumber.length < 10) {
      setError(i18n.t('invalid_phone'));
      return;
    }

    setLoading(true);
    try {
      await authService.register({
        phone_number: formData.phoneNumber,
        first_name: formData.firstName,
        last_name: formData.lastName,
        language_code: formData.languageCode,
        country_code: formData.countryCode,
      });
      setIsAuthenticated(true);
      // Reset navigation stack to MainTabs
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{i18n.t('register')}</Text>
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          <View style={styles.form}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.label}>{i18n.t('phone_number')} *</Text>
            <TextInput
              style={[styles.input, isRTL() && styles.inputRTL]}
              placeholder={i18n.t('enter_phone')}
              placeholderTextColor={Colors.textMuted}
              value={formData.phoneNumber}
              onChangeText={(text) => {
                setFormData({ ...formData, phoneNumber: text });
                setError('');
              }}
              keyboardType="phone-pad"
              textAlign={isRTL() ? 'right' : 'left'}
              editable={!loading}
            />

            <Text style={styles.label}>{i18n.t('first_name')} *</Text>
            <TextInput
              style={[styles.input, isRTL() && styles.inputRTL]}
              placeholder={i18n.t('enter_name')}
              placeholderTextColor={Colors.textMuted}
              value={formData.firstName}
              onChangeText={(text) =>
                setFormData({ ...formData, firstName: text })
              }
              textAlign={isRTL() ? 'right' : 'left'}
            />

            <Text style={styles.label}>{i18n.t('last_name')}</Text>
            <TextInput
              style={[styles.input, isRTL() && styles.inputRTL]}
              placeholder="Optional"
              placeholderTextColor={Colors.textMuted}
              value={formData.lastName}
              onChangeText={(text) =>
                setFormData({ ...formData, lastName: text })
              }
              textAlign={isRTL() ? 'right' : 'left'}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.buttonText}>{i18n.t('register')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.linkText}>
                Already have an account? {i18n.t('login')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  form: {
    padding: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
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
  errorText: {
    color: Colors.danger,
    fontSize: FontSizes.md,
    marginBottom: Spacing.md,
    textAlign: 'center',
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: Colors.background,
  },
  linkButton: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
  linkText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
  },
});
