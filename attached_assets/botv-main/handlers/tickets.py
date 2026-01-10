"""
Telegram Bot Handlers for Ticket System
Complaints, Deposits, Withdrawals with Image Upload Support
"""
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, ContentType
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from decimal import Decimal
from typing import Optional
import logging

from models import TicketType, TicketStatus
from services.control_panel.ticket_service import TicketService
from database import session_maker

logger = logging.getLogger(__name__)
router = Router(name="tickets")


class TicketStates(StatesGroup):
    """FSM states for ticket creation flow."""
    selecting_type = State()
    entering_subject = State()
    entering_description = State()
    entering_amount = State()
    uploading_images = State()


# ============================================================================
# TICKET CREATION
# ============================================================================

@router.message(Command("ticket"))
@router.message(Command("complaint"))
@router.message(Command("deposit"))
@router.message(Command("withdraw"))
async def cmd_create_ticket(message: Message, state: FSMContext):
    """
    Start ticket creation flow.
    Supports: /ticket, /complaint, /deposit, /withdraw
    """
    user_id = message.from_user.id
    command = message.text.split()[0][1:]  # Remove /
    
    # Pre-select ticket type based on command
    ticket_type_map = {
        "complaint": TicketType.COMPLAINT,
        "deposit": TicketType.DEPOSIT,
        "withdraw": TicketType.WITHDRAWAL
    }
    
    if command in ticket_type_map:
        await state.update_data(ticket_type=ticket_type_map[command])
        await ask_subject(message, state)
    else:
        # Show ticket type selection
        text = "🎫 <b>نوع التذكرة</b>\n\n"
        text += "اختر نوع التذكرة التي تريد إنشاءها:"
        
        keyboard = [
            [InlineKeyboardButton(text="📝 شكوى", callback_data="ticket_type:COMPLAINT")],
            [InlineKeyboardButton(text="💰 إيداع", callback_data="ticket_type:DEPOSIT")],
            [InlineKeyboardButton(text="💸 سحب", callback_data="ticket_type:WITHDRAWAL")],
            [InlineKeyboardButton(text="❓ دعم فني", callback_data="ticket_type:SUPPORT")],
            [InlineKeyboardButton(text="🎮 مشكلة في لعبة", callback_data="ticket_type:GAME_ISSUE")]
        ]
        
        await message.answer(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
        
        await state.set_state(TicketStates.selecting_type)


@router.callback_query(F.data.startswith("ticket_type:"))
async def ticket_type_selected(callback: CallbackQuery, state: FSMContext):
    """Handle ticket type selection."""
    ticket_type_str = callback.data.split(":")[1]
    ticket_type = TicketType[ticket_type_str]
    
    await state.update_data(ticket_type=ticket_type)
    await callback.answer()
    
    await ask_subject(callback.message, state)


async def ask_subject(message: Message, state: FSMContext):
    """Ask for ticket subject."""
    data = await state.get_data()
    ticket_type = data.get("ticket_type")
    
    ticket_type_names = {
        TicketType.COMPLAINT: "شكوى",
        TicketType.DEPOSIT: "إيداع",
        TicketType.WITHDRAWAL: "سحب",
        TicketType.SUPPORT: "دعم فني",
        TicketType.GAME_ISSUE: "مشكلة في لعبة"
    }
    
    text = f"🎫 <b>إنشاء تذكرة: {ticket_type_names.get(ticket_type, 'تذكرة')}</b>\n\n"
    text += "📝 <b>أدخل عنوان التذكرة:</b>\n"
    text += "<i>مثال: طلب سحب رصيد، مشكلة في اللعبة، إلخ</i>"
    
    await message.answer(text, parse_mode="HTML")
    await state.set_state(TicketStates.entering_subject)


@router.message(TicketStates.entering_subject)
async def process_subject(message: Message, state: FSMContext):
    """Process ticket subject and ask for description."""
    subject = message.text.strip()
    
    if len(subject) < 5:
        await message.answer("❌ العنوان قصير جداً. أدخل عنواناً أطول (5 أحرف على الأقل)")
        return
    
    await state.update_data(subject=subject)
    
    text = "📄 <b>أدخل وصف التذكرة:</b>\n\n"
    text += "<i>اشرح المشكلة أو الطلب بالتفصيل</i>"
    
    await message.answer(text, parse_mode="HTML")
    await state.set_state(TicketStates.entering_description)


@router.message(TicketStates.entering_description)
async def process_description(message: Message, state: FSMContext):
    """Process description and ask for amount (if needed) or images."""
    description = message.text.strip()
    
    if len(description) < 10:
        await message.answer("❌ الوصف قصير جداً. أدخل وصفاً أطول (10 أحرف على الأقل)")
        return
    
    await state.update_data(description=description)
    
    data = await state.get_data()
    ticket_type = data.get("ticket_type")
    
    # Ask for amount if deposit/withdrawal
    if ticket_type in [TicketType.DEPOSIT, TicketType.WITHDRAWAL]:
        text = "💰 <b>أدخل المبلغ:</b>\n\n"
        text += "<i>أدخل المبلغ المطلوب بالأرقام</i>"
        
        await message.answer(text, parse_mode="HTML")
        await state.set_state(TicketStates.entering_amount)
    else:
        await ask_for_images(message, state)


@router.message(TicketStates.entering_amount)
async def process_amount(message: Message, state: FSMContext):
    """Process amount and ask for images."""
    try:
        amount = Decimal(message.text.strip())
        
        if amount <= 0:
            await message.answer("❌ المبلغ يجب أن يكون أكبر من صفر")
            return
        
        await state.update_data(amount=str(amount))
        await ask_for_images(message, state)
        
    except (ValueError, ArithmeticError):
        await message.answer("❌ مبلغ غير صالح. أدخل رقماً صحيحاً")


async def ask_for_images(message: Message, state: FSMContext):
    """Ask user to upload images."""
    text = "📷 <b>رفع الصور (اختياري)</b>\n\n"
    text += "يمكنك الآن رفع صور توضيحية (إيصالات، لقطات شاشة، إلخ)\n\n"
    text += "📤 أرسل الصور واحدة تلو الأخرى\n"
    text += "✅ عند الانتهاء، اضغط على \"إنهاء\""
    
    keyboard = [
        [InlineKeyboardButton(text="✅ إنهاء وإرسال التذكرة", callback_data="ticket_finish")]
    ]
    
    await message.answer(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
        parse_mode="HTML"
    )
    
    await state.update_data(images=[])
    await state.set_state(TicketStates.uploading_images)


@router.message(TicketStates.uploading_images, F.content_type == ContentType.PHOTO)
async def process_image(message: Message, state: FSMContext):
    """Process uploaded image."""
    data = await state.get_data()
    images = data.get("images", [])
    
    # Get largest photo size
    photo = message.photo[-1]
    file_id = photo.file_id
    
    # Download file
    file = await message.bot.get_file(file_id)
    file_bytes = await message.bot.download_file(file.file_path)
    
    # Store in memory
    images.append({
        "file_id": file_id,
        "file_bytes": file_bytes.read(),
        "file_name": f"image_{len(images) + 1}.jpg"
    })
    
    await state.update_data(images=images)
    
    await message.answer(
        f"✅ تم رفع الصورة ({len(images)} صورة)\n"
        f"📤 أرسل المزيد أو اضغط \"إنهاء\" للإرسال"
    )


@router.callback_query(F.data == "ticket_finish")
async def finish_ticket(callback: CallbackQuery, state: FSMContext):
    """Create ticket with all data."""
    user_id = callback.from_user.id
    data = await state.get_data()
    
    ticket_type = data.get("ticket_type")
    subject = data.get("subject")
    description = data.get("description")
    amount = Decimal(data.get("amount", "0")) if data.get("amount") else None
    images = data.get("images", [])
    
    async with session_maker() as session:
        ticket_service = TicketService(session)
        
        try:
            # Create ticket
            ticket = await ticket_service.create_ticket(
                user_id=user_id,
                ticket_type=ticket_type,
                subject=subject,
                description=description,
                amount=amount,
                priority="MEDIUM"
            )
            
            # Upload images
            for img_data in images:
                await ticket_service.upload_attachment(
                    ticket_id=ticket.id,
                    file_content=img_data["file_bytes"],
                    file_name=img_data["file_name"],
                    uploaded_by=user_id
                )
            
            # Build success message
            ticket_type_names = {
                TicketType.COMPLAINT: "شكوى",
                TicketType.DEPOSIT: "إيداع",
                TicketType.WITHDRAWAL: "سحب",
                TicketType.SUPPORT: "دعم فني",
                TicketType.GAME_ISSUE: "مشكلة في لعبة"
            }
            
            text = "✅ <b>تم إنشاء التذكرة بنجاح!</b>\n\n"
            text += f"🎫 <b>رقم التذكرة:</b> <code>{ticket.ticket_number}</code>\n"
            text += f"📝 <b>النوع:</b> {ticket_type_names.get(ticket_type, 'تذكرة')}\n"
            text += f"📄 <b>العنوان:</b> {subject}\n"
            
            if amount:
                text += f"💰 <b>المبلغ:</b> {amount}\n"
            
            if images:
                text += f"📷 <b>الصور المرفقة:</b> {len(images)}\n"
            
            text += f"\n⏳ <b>الحالة:</b> قيد المراجعة\n"
            text += f"🕐 <b>التاريخ:</b> {ticket.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
            text += "سيتم الرد عليك في أقرب وقت ممكن"
            
            keyboard = [
                [InlineKeyboardButton(text="📋 عرض تذاكري", callback_data="my_tickets")],
                [InlineKeyboardButton(text="🎫 تذكرة جديدة", callback_data="new_ticket")]
            ]
            
            await callback.message.edit_text(
                text,
                reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                parse_mode="HTML"
            )
            
            await state.clear()
            await callback.answer("✅ تم إنشاء التذكرة")
            
            # Notify admins (TODO: integrate with notification system)
            logger.info(f"New ticket created: {ticket.ticket_number} by user {user_id}")
            
        except ValueError as e:
            await callback.answer(f"❌ {str(e)}", show_alert=True)
        except Exception as e:
            logger.error(f"Error creating ticket: {e}", exc_info=True)
            await callback.answer("❌ خطأ في إنشاء التذكرة", show_alert=True)


# ============================================================================
# VIEW TICKETS
# ============================================================================

@router.message(Command("my_tickets"))
@router.callback_query(F.data == "my_tickets")
async def cmd_my_tickets(message_or_callback, state: FSMContext = None):
    """Show user's tickets."""
    if isinstance(message_or_callback, Message):
        message = message_or_callback
        user_id = message.from_user.id
    else:
        callback = message_or_callback
        message = callback.message
        user_id = callback.from_user.id
    
    async with session_maker() as session:
        ticket_service = TicketService(session)
        
        tickets = await ticket_service.get_user_tickets(user_id, limit=10)
        
        if not tickets:
            text = "📋 <b>تذاكري</b>\n\n"
            text += "لا توجد تذاكر حالياً"
            
            keyboard = [
                [InlineKeyboardButton(text="🎫 إنشاء تذكرة جديدة", callback_data="new_ticket")]
            ]
            
            await message.answer(
                text,
                reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                parse_mode="HTML"
            )
            return
        
        # Build tickets list
        text = "📋 <b>تذاكري</b>\n\n"
        
        ticket_type_emojis = {
            TicketType.COMPLAINT: "📝",
            TicketType.DEPOSIT: "💰",
            TicketType.WITHDRAWAL: "💸",
            TicketType.SUPPORT: "❓",
            TicketType.GAME_ISSUE: "🎮"
        }
        
        status_emojis = {
            TicketStatus.PENDING: "⏳",
            TicketStatus.REVIEWING: "👀",
            TicketStatus.APPROVED: "✅",
            TicketStatus.REJECTED: "❌",
            TicketStatus.COMPLETED: "✔️"
        }
        
        keyboard = []
        
        for ticket in tickets:
            type_emoji = ticket_type_emojis.get(ticket.ticket_type, "🎫")
            status_emoji = status_emojis.get(ticket.status, "❓")
            
            text += f"{type_emoji} <b>{ticket.subject}</b>\n"
            text += f"🎫 {ticket.ticket_number}\n"
            text += f"{status_emoji} {ticket.status.value}\n"
            text += f"🕐 {ticket.created_at.strftime('%Y-%m-%d')}\n\n"
            
            keyboard.append([
                InlineKeyboardButton(
                    text=f"{type_emoji} {ticket.ticket_number}",
                    callback_data=f"ticket_view:{ticket.id}"
                )
            ])
        
        keyboard.append([
            InlineKeyboardButton(text="🎫 تذكرة جديدة", callback_data="new_ticket")
        ])
        
        if isinstance(message_or_callback, Message):
            await message.answer(
                text,
                reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                parse_mode="HTML"
            )
        else:
            await message.edit_text(
                text,
                reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
                parse_mode="HTML"
            )
            await message_or_callback.answer()


@router.callback_query(F.data.startswith("ticket_view:"))
async def view_ticket_details(callback: CallbackQuery):
    """Show ticket details."""
    ticket_id = int(callback.data.split(":")[1])
    user_id = callback.from_user.id
    
    async with session_maker() as session:
        ticket_service = TicketService(session)
        
        ticket = await ticket_service.get_ticket_by_id(ticket_id, include_attachments=True)
        
        if not ticket or ticket.user_id != user_id:
            await callback.answer("❌ التذكرة غير موجودة", show_alert=True)
            return
        
        ticket_type_names = {
            TicketType.COMPLAINT: "شكوى",
            TicketType.DEPOSIT: "إيداع",
            TicketType.WITHDRAWAL: "سحب",
            TicketType.SUPPORT: "دعم فني",
            TicketType.GAME_ISSUE: "مشكلة في لعبة"
        }
        
        status_names = {
            TicketStatus.PENDING: "قيد المراجعة",
            TicketStatus.REVIEWING: "قيد المراجعة",
            TicketStatus.APPROVED: "موافق عليها",
            TicketStatus.REJECTED: "مرفوضة",
            TicketStatus.COMPLETED: "مكتملة"
        }
        
        text = f"🎫 <b>تفاصيل التذكرة</b>\n\n"
        text += f"📝 <b>النوع:</b> {ticket_type_names.get(ticket.ticket_type, 'تذكرة')}\n"
        text += f"🎫 <b>الرقم:</b> <code>{ticket.ticket_number}</code>\n"
        text += f"📄 <b>العنوان:</b> {ticket.subject}\n"
        text += f"📋 <b>الوصف:</b>\n{ticket.description}\n\n"
        
        if ticket.amount:
            text += f"💰 <b>المبلغ:</b> {ticket.amount}\n"
        
        text += f"⏳ <b>الحالة:</b> {status_names.get(ticket.status, ticket.status.value)}\n"
        text += f"🕐 <b>التاريخ:</b> {ticket.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
        
        if ticket.attachments:
            text += f"📷 <b>الصور المرفقة:</b> {len(ticket.attachments)}\n\n"
        
        if ticket.admin_response:
            text += f"💬 <b>رد الإدارة:</b>\n{ticket.admin_response}\n"
            text += f"🕐 {ticket.responded_at.strftime('%Y-%m-%d %H:%M')}\n"
        
        keyboard = [
            [InlineKeyboardButton(text="🔙 رجوع", callback_data="my_tickets")]
        ]
        
        await callback.message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode="HTML"
        )
        
        await callback.answer()


@router.callback_query(F.data == "new_ticket")
async def new_ticket(callback: CallbackQuery, state: FSMContext):
    """Start new ticket creation."""
    await callback.message.delete()
    await cmd_create_ticket(callback.message, state)
    await callback.answer()
