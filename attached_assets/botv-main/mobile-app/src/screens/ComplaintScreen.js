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

export default function ComplaintScreen({ navigation }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setSubject('');
    setDescription('');
    setErrors({});
  };

  const handleSubmit = async () => {
    const newErrors = {};
    
    if (!subject) {
      newErrors.subject = 'Please enter a subject';
    }

    if (!description) {
      newErrors.description = 'Please describe your complaint';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.COMPLAINT, {
        subject: subject,
        description: description,
      });
      Alert.alert(
        i18n.t('success'),
        i18n.t('request_submitted') + '\n\nWe will review your complaint and respond as soon as possible.',
        [
          { text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) },
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
            <Text style={styles.infoTitle}>📨 {i18n.t('complaint')}</Text>
            <Text style={styles.infoText}>
              We take your complaints seriously. Please provide detailed information and we will respond as soon as possible.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>{i18n.t('subject')} *</Text>
            <TextInput
              style={[styles.input, isRTL() && styles.inputRTL, errors.subject && styles.inputError]}
              placeholder="Brief subject of your complaint"
              placeholderTextColor={Colors.textMuted}
              value={subject}
              onChangeText={(text) => {
                setSubject(text);
                setErrors({ ...errors, subject: null });
              }}
              textAlign={isRTL() ? 'right' : 'left'}
              editable={!loading}
            />
            {errors.subject ? <Text style={styles.errorText}>{errors.subject}</Text> : null}

            <Text style={styles.label}>{i18n.t('description')} *</Text>
            <TextInput
              style={[styles.input, styles.textArea, isRTL() && styles.inputRTL, errors.description && styles.inputError]}
              placeholder="Detailed description of your complaint..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setErrors({ ...errors, description: null });
              }}
              multiline
              numberOfLines={6}
              textAlign={isRTL() ? 'right' : 'left'}
              editable={!loading}
            />
            {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
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
    borderColor: Colors.warning,
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
    height: 150,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: Colors.warning,
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
    color: Colors.background,
  },
});
