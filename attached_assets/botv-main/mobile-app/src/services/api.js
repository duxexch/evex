/**
 * API Service - Centralized API communication
 * Handles all HTTP requests to the backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.langsense.local/api/v1';
const REQUEST_TIMEOUT = 30000; // 30 seconds

class APIService {
  constructor() {
    this.token = null;
    this.refreshToken = null;
  }

  /**
   * Set authentication token
   */
  async setToken(token, refreshToken = null) {
    this.token = token;
    this.refreshToken = refreshToken;
    
    // Store securely
    await SecureStore.setItemAsync('auth_token', token);
    if (refreshToken) {
      await SecureStore.setItemAsync('refresh_token', refreshToken);
    }
  }

  /**
   * Get authentication token
   */
  async getToken() {
    if (!this.token) {
      this.token = await SecureStore.getItemAsync('auth_token');
    }
    return this.token;
  }

  /**
   * Clear authentication
   */
  async clearToken() {
    this.token = null;
    this.refreshToken = null;
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
  }

  /**
   * Make HTTP request with timeout
   */
  async fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  /**
   * Make authenticated request
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        ...options,
        headers,
      });

      // Handle token expiration
      if (response.status === 401) {
        await this.clearToken();
        throw new Error('UNAUTHORIZED');
      }

      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'Request failed',
          errors: data.errors,
        };
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * GET request
   */
  get(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * POST request
   */
  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  }

  /**
   * PUT request
   */
  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    });
  }

  /**
   * DELETE request
   */
  delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  // ============= AUTH ENDPOINTS =============

  /**
   * Register new user
   */
  async register(phone, password, firstName, lastName, language = 'ar') {
    return this.post('/auth/register', {
      phone,
      password,
      first_name: firstName,
      last_name: lastName,
      language,
    });
  }

  /**
   * Login user
   */
  async login(phone, password) {
    const response = await this.post('/auth/login', {
      phone,
      password,
    });

    if (response.access_token) {
      await this.setToken(response.access_token, response.refresh_token);
    }

    return response;
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await this.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearToken();
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.post('/auth/refresh', {
      refresh_token: this.refreshToken,
    });

    if (response.access_token) {
      await this.setToken(response.access_token, response.refresh_token);
    }

    return response;
  }

  // ============= USER ENDPOINTS =============

  /**
   * Get current user profile
   */
  async getProfile() {
    return this.get('/users/me');
  }

  /**
   * Update user profile
   */
  async updateProfile(data) {
    return this.put('/users/me', data);
  }

  /**
   * Update user language preference
   */
  async setLanguage(language) {
    return this.put('/users/me', { language });
  }

  /**
   * Get user balance
   */
  async getBalance() {
    return this.get('/financial/balance');
  }

  // ============= FINANCIAL ENDPOINTS =============

  /**
   * Get deposit methods
   */
  async getDepositMethods() {
    return this.get('/financial/deposit-methods');
  }

  /**
   * Create deposit request
   */
  async createDeposit(amount, method) {
    return this.post('/financial/deposits', {
      amount,
      method,
    });
  }

  /**
   * Get withdrawal methods
   */
  async getWithdrawalMethods() {
    return this.get('/financial/withdrawal-methods');
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawal(amount, method, details) {
    return this.post('/financial/withdrawals', {
      amount,
      method,
      ...details,
    });
  }

  /**
   * Get transactions history
   */
  async getTransactions(page = 1, limit = 10) {
    return this.get(`/financial/transactions?page=${page}&limit=${limit}`);
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId) {
    return this.get(`/financial/transactions/${transactionId}`);
  }

  // ============= SUPPORT ENDPOINTS =============

  /**
   * Create support ticket
   */
  async createTicket(category, subject, message) {
    return this.post('/support/tickets', {
      category,
      subject,
      message,
    });
  }

  /**
   * Get support tickets
   */
  async getTickets(page = 1, limit = 10) {
    return this.get(`/support/tickets?page=${page}&limit=${limit}`);
  }

  /**
   * Get ticket details
   */
  async getTicket(ticketId) {
    return this.get(`/support/tickets/${ticketId}`);
  }

  /**
   * Add ticket reply
   */
  async addTicketReply(ticketId, message) {
    return this.post(`/support/tickets/${ticketId}/replies`, {
      message,
    });
  }

  // ============= SETTINGS ENDPOINTS =============

  /**
   * Get app settings
   */
  async getSettings() {
    return this.get('/settings');
  }

  /**
   * Get countries list
   */
  async getCountries() {
    return this.get('/settings/countries');
  }

  /**
   * Get supported languages
   */
  async getLanguages() {
    return this.get('/settings/languages');
  }
}

// Export singleton instance
export default new APIService();
