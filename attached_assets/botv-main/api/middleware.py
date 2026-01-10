#!/usr/bin/env python3
"""
Middleware configuration for FastAPI
"""

import logging
import sys


def setup_logging():
    """Configure logging for the API"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('api.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )
