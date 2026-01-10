/**
 * Auth Service - Handle user authentication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from './api';

class AuthService {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize auth service - check existing token
   */
  async initialize() {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        this.isAuthenticated = true;
        await this.fetchUser();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  }

  /**
   * Register new user
   */
  async register(phone, password, firstName, lastName, language = 'ar') {
    try {
      const response = await api.register(phone, password, firstName, lastName, language);
      
      this.user = response.user;
      this.isAuthenticated = true;
      
      return { success: true, user: response.user };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Registration failed' 
      };
    }
  }

  /**
   * Login user
   */
  async login(phone, password) {
    try {
      const response = await api.login(phone, password);
      
      this.user = response.user;
      this.isAuthenticated = true;
      
      // Store user data
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      
      return { success: true, user: response.user };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Login failed' 
      };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.user = null;
      this.isAuthenticated = false;
      await AsyncStorage.removeItem('user');
    }
  }

  /**
   * Fetch current user profile
   */
  async fetchUser() {
    try {
      const response = await api.getProfile();
      this.user = response;
      await AsyncStorage.setItem('user', JSON.stringify(response));
      return response;
    } catch (error) {
      console.error('Fetch user error:', error);
      if (error.status === 401) {
        this.isAuthenticated = false;
        this.user = null;
      }
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data) {
    try {
      const response = await api.updateProfile(data);
      this.user = response;
      await AsyncStorage.setItem('user', JSON.stringify(response));
      return response;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isLoggedIn() {
    return this.isAuthenticated && this.user !== null;
  }
}

export default new AuthService();
      
      // Store token
      await AsyncStorage.setItem('authToken', access_token);
      await AsyncStorage.setItem('userId', user_id.toString());
      await AsyncStorage.setItem('customerCode', customer_code || '');
      
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Registration failed';
    }
  }

  async logout() {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('customerCode');
  }

  async isAuthenticated() {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  }

  async getToken() {
    return await AsyncStorage.getItem('authToken');
  }

  async getCurrentUser() {
    try {
      const response = await api.get(API_ENDPOINTS.PROFILE);
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to fetch user';
    }
  }
}

export default new AuthService();
