"""Affiliates API Package"""
from api.v1.control_panel.affiliates.schemas import *

__all__ = [
    "AffiliateCreate",
    "AffiliateResponse",
    "AffiliateTierUpdate",
    "ReferralCreate",
    "ReferralResponse",
    "AffiliateCommissionCreate",
    "AffiliateCommissionResponse",
    "CommissionTransitionRequest",
    "PayoutRequest",
    "PayoutResponse",
    "AffiliateStatsResponse",
]
