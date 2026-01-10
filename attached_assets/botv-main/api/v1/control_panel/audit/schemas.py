"""
Audit API Schemas
Request/response models for audit logging endpoints
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class AuditLogBase(BaseModel):
    """Base model for audit log"""
    action_type: str = Field(..., min_length=1, max_length=100)
    resource_type: str = Field(..., min_length=1, max_length=100)
    resource_id: Optional[int] = None
    changes: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, pattern="^(success|failure)$")


class AuditLogCreate(AuditLogBase):
    """Create audit log"""
    user_id: int


class AuditLogResponse(AuditLogBase):
    """Audit log response"""
    id: int
    user_id: int
    created_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    """Audit log list response"""
    total: int
    skip: int
    limit: int
    logs: List[AuditLogResponse]


class AuditLogFilterRequest(BaseModel):
    """Audit log filter request"""
    action_type: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    user_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AuditLogSummaryResponse(BaseModel):
    """Audit log summary"""
    total_logs: int
    date_range: dict
    actions_by_type: Dict[str, int]
    resources_by_type: Dict[str, int]
    top_users: List[dict]


class AuditTrailResponse(BaseModel):
    """Audit trail for specific resource"""
    resource_type: str
    resource_id: int
    total_changes: int
    trail: List[AuditLogResponse]


class ChangeHistoryResponse(BaseModel):
    """Change history for resource"""
    resource_type: str
    resource_id: int
    field: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    changed_by: int
    changed_at: datetime


class ExportAuditLogsRequest(BaseModel):
    """Export audit logs request"""
    start_date: datetime
    end_date: datetime
    format: str = Field('json', pattern="^(json|csv)$")
    filters: Optional[AuditLogFilterRequest] = None


class ExportAuditLogsResponse(BaseModel):
    """Export audit logs response"""
    file_url: str
    file_size: int
    format: str
    created_at: datetime
    expires_at: datetime
