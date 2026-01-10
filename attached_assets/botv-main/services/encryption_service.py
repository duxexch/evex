#!/usr/bin/env python3
"""
✅ ENCRYPTION UTILITIES
Secure encryption/decryption for sensitive data like phone numbers
"""

from cryptography.fernet import Fernet
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class EncryptionService:
    """تشفير/فك تشفير البيانات الحساسة"""
    
    def __init__(self, encryption_key: str):
        """
        Initialize encryption service
        
        Args:
            encryption_key: 32-byte key (as hex string)
        """
        try:
            # Convert hex string to bytes
            key_bytes = bytes.fromhex(encryption_key)
            
            # Derive Fernet key from raw bytes
            # Fernet requires a base64-encoded 32-byte key
            import base64
            self.cipher = Fernet(base64.urlsafe_b64encode(key_bytes[:32]))
        except Exception as e:
            logger.error(f"❌ فشل تهيئة التشفير: {e}")
            raise
    
    def encrypt(self, plaintext: str) -> bytes:
        """تشفير نص"""
        if not plaintext:
            return None
        
        try:
            ciphertext = self.cipher.encrypt(plaintext.encode('utf-8'))
            return ciphertext
        except Exception as e:
            logger.error(f"❌ فشل التشفير: {e}")
            raise
    
    def decrypt(self, ciphertext: bytes) -> str:
        """فك تشفير"""
        if not ciphertext:
            return None
        
        try:
            plaintext = self.cipher.decrypt(ciphertext)
            return plaintext.decode('utf-8')
        except Exception as e:
            logger.error(f"❌ فشل فك التشفير: {e}")
            raise
    
    @staticmethod
    def generate_key() -> str:
        """أنشئ مفتاح تشفير عشوائي جديد"""
        return Fernet.generate_key().hex()
