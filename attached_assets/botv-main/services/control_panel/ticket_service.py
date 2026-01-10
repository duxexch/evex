"""
Ticket Service - Complaints, Deposits, Withdrawals with Image Upload
Supports image attachments with secure storage and validation
"""
import os
import uuid
import magic
from pathlib import Path
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, BinaryIO
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from models import (
    Ticket, TicketAttachment, User, AuditLog,
    TicketType, TicketStatus
)
from config import settings
import logging

logger = logging.getLogger(__name__)


class TicketService:
    """
    Secure ticket service for complaints, deposits, and withdrawals.
    
    Key Features:
    - Image upload with validation (MIME type, size)
    - Multiple attachments per ticket
    - Admin response system
    - Priority management
    - Status tracking
    - Full audit trail
    """
    
    # Allowed MIME types for images
    ALLOWED_IMAGE_TYPES = {
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    }
    
    # Max file size: 10MB
    MAX_FILE_SIZE = 10 * 1024 * 1024
    
    # Upload directory
    UPLOAD_DIR = Path(settings.UPLOAD_DIR if hasattr(settings, 'UPLOAD_DIR') else '/app/uploads/tickets')
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self._ensure_upload_dir()
    
    def _ensure_upload_dir(self):
        """Ensure upload directory exists."""
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ticket upload directory: {self.UPLOAD_DIR}")
    
    # ============================================================================
    # TICKET CREATION
    # ============================================================================
    
    async def create_ticket(
        self,
        user_id: int,
        ticket_type: TicketType,
        subject: str,
        description: str,
        amount: Optional[Decimal] = None,
        priority: str = 'MEDIUM'
    ) -> Ticket:
        """
        Create a new ticket.
        
        Args:
            user_id: User creating the ticket
            ticket_type: Type (COMPLAINT, DEPOSIT, WITHDRAWAL, etc.)
            subject: Short subject line
            description: Detailed description
            amount: Amount for deposit/withdrawal
            priority: LOW, MEDIUM, HIGH, URGENT
        """
        # Validate user exists
        user_result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Validate amount for financial tickets
        if ticket_type in [TicketType.DEPOSIT, TicketType.WITHDRAWAL]:
            if not amount or amount <= Decimal('0'):
                raise ValueError(f"Amount required for {ticket_type.value} ticket")
        
        # Generate unique ticket number
        ticket_number = await self._generate_ticket_number()
        
        # Create ticket
        ticket = Ticket(
            ticket_number=ticket_number,
            user_id=user_id,
            ticket_type=ticket_type,
            status=TicketStatus.PENDING,
            subject=subject,
            description=description,
            amount=amount,
            priority=priority
        )
        
        self.session.add(ticket)
        await self.session.commit()
        await self.session.refresh(ticket)
        
        # Audit log
        await self._log_audit(
            admin_id=user_id,
            action='ticket_created',
            target_type='ticket',
            target_id=ticket.id,
            details={
                'ticket_number': ticket_number,
                'type': ticket_type.value,
                'subject': subject,
                'amount': str(amount) if amount else None
            }
        )
        
        logger.info(f"Ticket created: {ticket_number} | Type: {ticket_type.value} | User: {user_id}")
        return ticket
    
    async def _generate_ticket_number(self) -> str:
        """Generate unique ticket number (e.g., TCK-2024-001234)."""
        # Get count of tickets today
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        result = await self.session.execute(
            select(func.count(Ticket.id)).where(
                Ticket.created_at >= today_start
            )
        )
        count = result.scalar_one()
        
        year = datetime.now(timezone.utc).year
        return f"TCK-{year}-{count + 1:06d}"
    
    # ============================================================================
    # ATTACHMENT MANAGEMENT
    # ============================================================================
    
    async def upload_attachment(
        self,
        ticket_id: int,
        file_content: bytes,
        file_name: str,
        uploaded_by: int
    ) -> TicketAttachment:
        """
        Upload and attach image to ticket.
        
        Steps:
        1. Validate ticket exists
        2. Validate file size
        3. Validate MIME type
        4. Generate secure filename
        5. Save file to disk
        6. Create database record
        """
        # Get ticket
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")
        
        # Validate file size
        file_size = len(file_content)
        if file_size > self.MAX_FILE_SIZE:
            raise ValueError(f"File size {file_size} exceeds maximum {self.MAX_FILE_SIZE}")
        
        # Detect MIME type
        mime_type = magic.from_buffer(file_content, mime=True)
        if mime_type not in self.ALLOWED_IMAGE_TYPES:
            raise ValueError(f"Invalid file type: {mime_type}. Allowed: {self.ALLOWED_IMAGE_TYPES}")
        
        # Generate secure filename
        file_ext = Path(file_name).suffix or self._get_extension_from_mime(mime_type)
        secure_filename = f"{uuid.uuid4().hex}{file_ext}"
        
        # Create subdirectory by ticket ID
        ticket_dir = self.UPLOAD_DIR / str(ticket_id)
        ticket_dir.mkdir(parents=True, exist_ok=True)
        
        # Full file path
        file_path = ticket_dir / secure_filename
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create attachment record
        attachment = TicketAttachment(
            ticket_id=ticket_id,
            file_path=str(file_path),
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=uploaded_by
        )
        
        self.session.add(attachment)
        await self.session.commit()
        await self.session.refresh(attachment)
        
        # Audit log
        await self._log_audit(
            admin_id=uploaded_by,
            action='ticket_attachment_uploaded',
            target_type='ticket',
            target_id=ticket_id,
            details={
                'file_name': file_name,
                'file_size': file_size,
                'mime_type': mime_type
            }
        )
        
        logger.info(f"Attachment uploaded: {file_name} | Ticket: {ticket.ticket_number} | Size: {file_size}")
        return attachment
    
    def _get_extension_from_mime(self, mime_type: str) -> str:
        """Get file extension from MIME type."""
        mapping = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp'
        }
        return mapping.get(mime_type, '.bin')
    
    async def get_attachment_content(self, attachment_id: int) -> bytes:
        """Get attachment file content."""
        result = await self.session.execute(
            select(TicketAttachment).where(TicketAttachment.id == attachment_id)
        )
        attachment = result.scalar_one_or_none()
        
        if not attachment:
            raise ValueError(f"Attachment {attachment_id} not found")
        
        file_path = Path(attachment.file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(file_path, 'rb') as f:
            return f.read()
    
    async def delete_attachment(
        self,
        attachment_id: int,
        deleted_by: int
    ):
        """Delete attachment file and record."""
        result = await self.session.execute(
            select(TicketAttachment).where(TicketAttachment.id == attachment_id)
        )
        attachment = result.scalar_one_or_none()
        
        if not attachment:
            raise ValueError(f"Attachment {attachment_id} not found")
        
        # Delete file from disk
        file_path = Path(attachment.file_path)
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted attachment file: {file_path}")
        
        # Delete from database
        await self.session.delete(attachment)
        await self.session.commit()
        
        # Audit log
        await self._log_audit(
            admin_id=deleted_by,
            action='ticket_attachment_deleted',
            target_type='ticket',
            target_id=attachment.ticket_id,
            details={'file_name': attachment.file_name}
        )
    
    # ============================================================================
    # TICKET MANAGEMENT
    # ============================================================================
    
    async def get_ticket_by_id(
        self,
        ticket_id: int,
        include_attachments: bool = False
    ) -> Optional[Ticket]:
        """Get ticket by ID."""
        query = select(Ticket).where(Ticket.id == ticket_id)
        
        if include_attachments:
            query = query.options(selectinload(Ticket.attachments))
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_ticket_by_number(self, ticket_number: str) -> Optional[Ticket]:
        """Get ticket by ticket number."""
        result = await self.session.execute(
            select(Ticket)
            .options(selectinload(Ticket.attachments))
            .where(Ticket.ticket_number == ticket_number)
        )
        return result.scalar_one_or_none()
    
    async def get_user_tickets(
        self,
        user_id: int,
        ticket_type: Optional[TicketType] = None,
        status: Optional[TicketStatus] = None,
        limit: int = 50
    ) -> List[Ticket]:
        """Get tickets for a user."""
        query = select(Ticket).where(Ticket.user_id == user_id)
        
        if ticket_type:
            query = query.where(Ticket.ticket_type == ticket_type)
        
        if status:
            query = query.where(Ticket.status == status)
        
        query = query.order_by(Ticket.created_at.desc()).limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_pending_tickets(
        self,
        ticket_type: Optional[TicketType] = None,
        priority: Optional[str] = None,
        limit: int = 100
    ) -> List[Ticket]:
        """Get pending tickets for admin review."""
        query = select(Ticket).where(
            or_(
                Ticket.status == TicketStatus.PENDING,
                Ticket.status == TicketStatus.REVIEWING
            )
        )
        
        if ticket_type:
            query = query.where(Ticket.ticket_type == ticket_type)
        
        if priority:
            query = query.where(Ticket.priority == priority)
        
        # Order by priority (URGENT first) and creation time
        priority_order = {
            'URGENT': 1,
            'HIGH': 2,
            'MEDIUM': 3,
            'LOW': 4
        }
        
        query = query.order_by(Ticket.created_at.desc()).limit(limit)
        
        result = await self.session.execute(query)
        tickets = list(result.scalars().all())
        
        # Sort by priority
        return sorted(tickets, key=lambda t: priority_order.get(t.priority, 99))
    
    async def respond_to_ticket(
        self,
        ticket_id: int,
        admin_id: int,
        response: str,
        new_status: TicketStatus
    ) -> Ticket:
        """
        Admin responds to ticket and updates status.
        
        Args:
            ticket_id: Ticket ID
            admin_id: Admin user ID
            response: Admin response message
            new_status: New ticket status (APPROVED, REJECTED, COMPLETED)
        """
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")
        
        # Update ticket
        ticket.admin_response = response
        ticket.responded_by_admin_id = admin_id
        ticket.responded_at = datetime.now(timezone.utc)
        ticket.status = new_status
        ticket.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(ticket)
        
        # Audit log
        await self._log_audit(
            admin_id=admin_id,
            action='ticket_responded',
            target_type='ticket',
            target_id=ticket_id,
            details={
                'ticket_number': ticket.ticket_number,
                'status': new_status.value,
                'response_preview': response[:100]
            }
        )
        
        logger.info(f"Ticket responded: {ticket.ticket_number} | Status: {new_status.value} | Admin: {admin_id}")
        return ticket
    
    async def update_ticket_status(
        self,
        ticket_id: int,
        new_status: TicketStatus,
        admin_id: int
    ) -> Ticket:
        """Update ticket status."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")
        
        old_status = ticket.status
        ticket.status = new_status
        ticket.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(ticket)
        
        await self._log_audit(
            admin_id=admin_id,
            action='ticket_status_updated',
            target_type='ticket',
            target_id=ticket_id,
            details={
                'ticket_number': ticket.ticket_number,
                'old_status': old_status.value,
                'new_status': new_status.value
            }
        )
        
        return ticket
    
    # ============================================================================
    # HELPER METHODS
    # ============================================================================
    
    async def _log_audit(
        self,
        admin_id: int,
        action: str,
        target_type: str,
        target_id: int,
        details: dict
    ):
        """Log action to audit trail."""
        audit = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details
        )
        self.session.add(audit)
        await self.session.flush()
