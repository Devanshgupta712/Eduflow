from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
from datetime import datetime, date, time, timezone, timedelta
import os, uuid, base64, json, random, logging

from app.database import get_db
from app.models.user import User, Role
from app.models.registration import Document
from app.schemas.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut, SendOTPRequest, VerifyOTPRequest, VerifyEmailRequest
from app.middleware.auth import create_access_token, get_current_user, require_roles
from app.config import settings
from app.utils.email import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["Auth"])

logger = logging.getLogger(__name__)

# ─── In-memory Phone OTP Store ───────────────────────────
# Format: { phone: { "otp": "123456", "expires": datetime, "verified": bool } }
_otp_store: dict[str, dict] = {}

def _generate_otp() -> str:
    return str(random.randint(100000, 999999))

def _send_email_otp(to_email: str, otp: str) -> tuple[bool, str]:
    """Send OTP via SMTP utility."""
    try:
        print(f"DEBUG: Attempting to send SMTP email to {to_email} with OTP {otp}")
        success = send_verification_email(to_email, otp)
        if success:
            return True, ""
        return False, "SMTP utility failed (check logs)"
    except Exception as e:
        print(f"DEBUG: Internal error in _send_email_otp: {str(e)}")
        logger.error(f"Internal error in _send_email_otp: {e}")
        return False, str(e)





def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Auto-provision super admin if missing
    if body.email == "superadmin@apptech.com" and body.password == "SuperAdmin123!":
        from app.models.user import Role
        result = await db.execute(select(User).where(User.email == body.email))
        sa = result.scalars().first()
        if not sa:
            sa = User(email=body.email, password=get_password_hash(body.password), name="Super Admin", role=Role.SUPER_ADMIN, is_active=True)
            db.add(sa)
            await db.flush()

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(selectinload(User.permissions))
        .where(User.email == body.email)
    )
    user = result.scalars().first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    from app.models.session import StudentFeedback
    from app.models.notification import Feedback as TraineeFeedback
    from sqlalchemy import func
    
    if user.role.value == 'TRAINER':
        rating_result = await db.execute(
            select(func.avg(StudentFeedback.rating))
            .where(StudentFeedback.target_id == user.id, StudentFeedback.target_type == 'TRAINER')
        )
        avg_rating = rating_result.scalar()
    elif user.role.value == 'STUDENT':
        rating_result = await db.execute(
            select(func.avg(TraineeFeedback.rating))
            .where(TraineeFeedback.student_id == user.id)
        )
        avg_rating = rating_result.scalar()
    else:
        avg_rating = 0.0

    user.average_rating = float(avg_rating) if avg_rating else 0.0

    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Your portal is blocked due to repeated policy violations. Please contact Super Admin.")

    token = create_access_token({"sub": user.id, "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/notifications/read-all")
async def mark_notifications_read(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.notification import Notification
    from sqlalchemy import update
    await db.execute(
        update(Notification).where(Notification.user_id == user.id).values(read=True)
    )
    await db.flush()
    return {"status": "success"}

@router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.notification import Notification
    result = await db.execute(select(Notification).where(Notification.id == notif_id, Notification.user_id == user.id))
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    await db.commit()
    return {"status": "success", "id": notif.id}



@router.post("/send-otp")
async def send_otp(body: SendOTPRequest):
    email = body.email.strip().lower()
    if not email or '@' not in email:
        raise HTTPException(status_code=400, detail="Please provide a valid email address")
    
    otp = _generate_otp()
    _otp_store[email] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "verified": False
    }
    
    success, err_msg = _send_email_otp(email, otp)
    if success:
        return {"status": "success", "message": "OTP sent successfully via Email"}
    else:
        raise HTTPException(status_code=500, detail=f"SMTP Server Connection Failed: {err_msg}")

@router.post("/verify-otp")
async def verify_otp(body: VerifyOTPRequest):
    email = body.email.lower()
        
    record = _otp_store.get(email)
    if not record:
        raise HTTPException(status_code=400, detail="OTP not sent or expired")
        
    if datetime.now(timezone.utc) > record["expires"]:
        del _otp_store[email]
        raise HTTPException(status_code=400, detail="OTP expired")
        
    if record["otp"] != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    record["verified"] = True
    return {"status": "success", "message": "Email verified successfully"}

@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_verified:
        return {"status": "success", "message": "Email already verified"}
        
    if not user.verification_code or user.verification_code != body.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    if user.verification_expiry and datetime.now(timezone.utc) > user.verification_expiry.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code expired")
        
    user.is_verified = True
    user.verification_code = None
    user.verification_expiry = None
    await db.flush()
    
    return {"status": "success", "message": "Email verified successfully"}

@router.post("/resend-verification")
async def resend_verification(body: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_verified:
        return {"status": "success", "message": "Email already verified"}
        
    verification_code = _generate_otp()
    user.verification_code = verification_code
    user.verification_expiry = datetime.now(timezone.utc) + timedelta(hours=24)
    
    success = send_verification_email(user.email, verification_code)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send verification email")
        
    await db.flush()
    return {"status": "success", "message": "Verification code resent successfully"}

@router.post("/register", response_model=UserOut)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if body.role == "STUDENT":
        if not body.phone:
            raise HTTPException(status_code=400, detail="Phone number is required for students.")
            
#        email = body.email.lower()
#        record = _otp_store.get(email)
#        if not record or not record.get("verified"):
#            raise HTTPException(status_code=400, detail="Email address not verified. Please verify your email via OTP first.")
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")



    hashed = get_password_hash(body.password)

    student_id = None
    if body.role == "STUDENT":
        from sqlalchemy import func
        # Robust student ID generation: APC-YYYY-XXXX
        current_year = datetime.now().year
        pattern = f"APC-{current_year}-%"
        result = await db.execute(
            select(User.student_id)
            .where(User.student_id.like(pattern))
            .order_by(User.student_id.desc())
            .limit(1)
        )
        last_sid = result.scalar()
        
        if last_sid:
            try:
                last_num = int(last_sid.split("-")[-1])
                new_num = last_num + 1
            except:
                new_num = 1
        else:
            new_num = 1
            
        student_id = f"APC-{current_year}-{new_num:04d}"

    user = User(
        email=body.email,
        password=hashed,
        name=body.name,
        phone=body.phone,
        role=body.role,
        student_id=student_id,
    )

    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Students are NOT auto-assigned to any batch or course during registration.
    # Admin will manually assign batches/courses via the User Management panel.

    # Clean up OTP after successful registration
    if body.role == "STUDENT" and body.email in _otp_store:
        del _otp_store[body.email]

    # Ensure permissions is set to None for new students to avoid lazy loading crash
    user.permissions = None
    return UserOut.model_validate(user)


# ─── Public Endpoints ───────────────────────────────────
@router.get("/public/courses")
async def get_public_courses(db: AsyncSession = Depends(get_db)):
    from app.models.course import Course
    result = await db.execute(select(Course).order_by(Course.created_at.desc()))
    courses = result.scalars().all()
    out = []
    icons = ["💻", "🔥", "📊", "🚀", "🤖", "☁️", "⚙️", "📱"]
    for i, c in enumerate(courses):
        out.append({
            "id": c.id,
            "title": c.name,
            "category": "Bootcamp",
            "#icon": "Will use static array mapped or generated",
            "price": f"₹{c.fee:,.0f}" if c.fee else "Free",
            "duration": c.duration or "6 Months",
            "description": c.description or "",
            "rating": "4.9/5.0",
            "icon": icons[i % len(icons)]
        })
    return out

@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Your portal is blocked.")
    
    from app.models.session import StudentFeedback
    from app.models.notification import Feedback as TraineeFeedback
    from sqlalchemy import func
    
    if user.role.value == 'TRAINER':
        rating_result = await db.execute(
            select(func.avg(StudentFeedback.rating))
            .where(StudentFeedback.target_id == user.id, StudentFeedback.target_type == 'TRAINER')
        )
        avg_rating = rating_result.scalar()
    elif user.role.value == 'STUDENT':
        rating_result = await db.execute(
            select(func.avg(TraineeFeedback.rating))
            .where(TraineeFeedback.student_id == user.id)
        )
        avg_rating = rating_result.scalar()
    else:
        avg_rating = 0.0

    user.average_rating = float(avg_rating) if avg_rating else 0.0
    
    return UserOut.model_validate(user)


@router.patch("/profile")
async def update_profile(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if "name" in body:
        user.name = body["name"]
    if "phone" in body:
        user.phone = body["phone"]
    if "avatar" in body:
        avatar_data = body["avatar"]
        # If it's a base64 data URL, upload to Cloudinary for proper storage
        if avatar_data and isinstance(avatar_data, str) and avatar_data.startswith("data:image"):
            try:
                import cloudinary
                import cloudinary.uploader
                from app.config import settings as cfg
                if not cloudinary.config().cloud_name:
                    cloudinary.config(
                        cloud_name=cfg.CLOUDINARY_CLOUD_NAME,
                        api_key=cfg.CLOUDINARY_API_KEY,
                        api_secret=cfg.CLOUDINARY_API_SECRET
                    )
                upload_result = cloudinary.uploader.upload(
                    avatar_data,
                    folder="lms_avatars",
                    public_id=f"avatar_{user.id}",
                    overwrite=True,
                    transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}]
                )
                user.avatar = upload_result.get("secure_url")
            except Exception as e:
                logger.warning(f"Cloudinary avatar upload failed: {e}, storing base64")
                user.avatar = avatar_data
        else:
            user.avatar = avatar_data
    if "dob" in body:
        user.dob = body["dob"]
    if "education_status" in body:
        user.education_status = body["education_status"]
    if "highest_education" in body:
        user.highest_education = body["highest_education"]
    if "degree" in body:
        user.degree = body["degree"]
    if "passing_year" in body:
        user.passing_year = body["passing_year"]
    await db.commit()
    return {"status": "updated", "name": user.name, "phone": user.phone, "avatar": user.avatar}


@router.post("/change-password")
async def change_own_password(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Allow any authenticated user to change their own password."""
    current_password = body.get("current_password", "")
    new_password = body.get("new_password", "")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Both current_password and new_password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    if not verify_password(current_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    user.password = get_password_hash(new_password)
    await db.flush()
    return {"status": "password_changed"}

@router.patch("/users/{user_id}/unblock")
async def unblock_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_roles(Role.SUPER_ADMIN))
):
    """Only SUPER_ADMIN can unblock a user."""
    from app.models.user import User as UserModel
    res = await db.execute(select(UserModel).where(UserModel.id == user_id))
    target = res.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    target.is_blocked = False
    await db.commit()
    return {"status": "unblocked"}

# ─── Document endpoints ──────────────────────────────
@router.get("/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document).where(Document.student_id == user.id).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id, "type": d.type, "file_name": d.file_name,
            "file_url": d.file_url, "verified": d.verified,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.post("/documents", status_code=201)
async def upload_document(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a document with base64 encoded file content."""
    doc_type = body.get("type", "OTHER")
    file_name = body.get("file_name", "document")
    file_data = body.get("file_data")  # base64 encoded

    if file_data:
        try:
            import cloudinary.uploader
            from app.config import settings
            
            # Configure Cloudinary if not done globally
            if not cloudinary.config().cloud_name:
                 import cloudinary
                 cloudinary.config(
                     cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                     api_key=settings.CLOUDINARY_API_KEY,
                     api_secret=settings.CLOUDINARY_API_SECRET
                 )

            # Upload to Cloudinary
            upload_result = cloudinary.uploader.upload(
                f"data:image/png;base64,{file_data}", # Assuming image, cloudinary handles auto-detection via base64 prefix
                folder="lms_documents",
                public_id=f"{user.id}_{doc_type}_{uuid.uuid4().hex[:8]}"
            )
            file_url = upload_result.get("secure_url")
            
        except Exception as e:
            # Fallback to local storage if Cloudinary fails or is not configured
            ext = os.path.splitext(file_name)[1] or ".pdf"
            saved_name = f"{user.id}_{doc_type}_{uuid.uuid4().hex[:8]}{ext}"
            file_path = os.path.join(UPLOAD_DIR, saved_name)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(file_data))
            file_url = f"/uploads/documents/{saved_name}"
            print(f"Cloudinary upload failed/skipped, using local storage: {e}")
    else:
        file_url = body.get("file_url", "")

    doc = Document(
        student_id=user.id,
        type=doc_type,
        file_name=file_name,
        file_url=file_url,
    )
    db.add(doc)
    await db.flush()
    return {"id": doc.id, "status": "uploaded", "file_url": file_url}


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.student_id != user.id:
        raise HTTPException(403, "Not your document")
    db.delete(doc)
    await db.flush()
    return {"status": "deleted"}


# ─── My Courses ─────────────────────────────────────────
@router.get("/my-courses")
async def get_my_courses(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.registration import Registration
    result = await db.execute(
        select(Registration).where(Registration.student_id == user.id)
    )
    regs = result.scalars().all()
    out = []
    for r in regs:
        from app.models.course import Course
        course = await db.get(Course, r.course_id)
        if course:
            out.append({
                "id": course.id,
                "name": course.name,
                "description": course.description,
                "duration": course.duration,
                "fee_total": r.fee_amount,
                "fee_paid": r.fee_paid,
                "status": r.status,
                "registration_date": r.created_at.isoformat() if r.created_at else None
            })
    return out


# ─── Notifications ──────────────────────────────────────
@router.get("/notifications")
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.notification import Notification
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    return [
        {
            "id": n.id, "title": n.title, "message": n.message,
            "read": n.read, "type": n.type, "reference_id": n.reference_id,
            "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
        }
        for n in notifs
    ]

import json
import base64
import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in meters using haversine formula."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@router.post("/attendance/scan")
async def scan_attendance_qr(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    token = body.get("qr_token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing QR token")
        
    from app.models.user import Role
    role_val = str(user.role.value if hasattr(user.role, 'value') else user.role).strip().upper()

    # Super Admins are exempt from punch-in
    if role_val == "SUPER_ADMIN":
        raise HTTPException(
            status_code=403, 
            detail="Super Admins are exempt from punch-in requirements."
        )

    # --- Geolocation radius check ---
    from app.models.setting import SystemSetting
    scan_lat = body.get("latitude")
    scan_lng = body.get("longitude")
    
    if scan_lat is not None and scan_lng is not None:
        # Fetch office location settings
        loc_result = await db.execute(select(SystemSetting).where(SystemSetting.key == "office_latitude"))
        lat_setting = loc_result.scalars().first()
        loc_result2 = await db.execute(select(SystemSetting).where(SystemSetting.key == "office_longitude"))
        lng_setting = loc_result2.scalars().first()
        loc_result3 = await db.execute(select(SystemSetting).where(SystemSetting.key == "office_radius_meters"))
        radius_setting = loc_result3.scalars().first()
        
        if lat_setting and lng_setting and lat_setting.value not in ("0.0", "", None) and lng_setting.value not in ("0.0", "", None):
            office_lat = float(lat_setting.value)
            office_lng = float(lng_setting.value)
            allowed_radius = float(radius_setting.value) if radius_setting else 200.0
            
            distance = haversine_distance(float(scan_lat), float(scan_lng), office_lat, office_lng)
            if distance > allowed_radius:
                raise HTTPException(
                    status_code=403,
                    detail=f"You are {int(distance)}m away from the office. QR scan is only allowed within {int(allowed_radius)}m radius. Please move closer to the institute."
                )
    # If no location provided, allow the scan to proceed (GPS may be unavailable on this device)


    # --- Validate QR token ---
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "active_qr_secret"))
    setting = result.scalars().first()
    
    is_valid = True # Bypassing QR secret check for now as requested to remove all verification
    """
    is_valid = False
    
    # Check against the persistent global QR secret
    if setting and token == setting.value:
        is_valid = True
    else:
        # Fallback: check old JSON payload format (batch-specific QR)
        try:
            padded = token + '=' * (-len(token) % 4)
            decoded_bytes = base64.b64decode(padded)
            payload = json.loads(decoded_bytes.decode())
            expiration = payload.get("exp")
            if expiration:
                exp_date = datetime.fromisoformat(expiration)
                if exp_date.tzinfo is None:
                    exp_date = exp_date.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) < exp_date:
                    is_valid = True
        except:
            pass
    """


    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code. Please scan the current one displayed at the institute.")

    # --- Punch In/Out Toggle (TimeTracking only) ---
    from app.models.attendance import TimeTracking
    from sqlalchemy import and_, func
    
    # Calculate IST as naive datetime (DB stores naive)
    utc_now = datetime.utcnow()
    now = utc_now + timedelta(hours=5, minutes=30)
    today = now.date()
    
    # Get all sessions for today — use with_for_update to prevent duplicate concurrent inserts
    all_today_result = await db.execute(
        select(TimeTracking).where(
            and_(
                TimeTracking.user_id == user.id,
                func.date(TimeTracking.date) == today
            )
        ).order_by(TimeTracking.login_time.desc()).with_for_update()
    )
    today_records = all_today_result.scalars().all()
    time_record = today_records[0] if today_records else None

    # ─── Duplicate / rapid scan guard ──────────────────────
    # Reject if last event (punch-in OR punch-out) was within 30 seconds.
    # This prevents the QR scanner firing multiple frames as separate records.
    COOLDOWN_SECONDS = 30
    if time_record:
        last_event_time = time_record.logout_time or time_record.login_time
        if last_event_time and (now - last_event_time).total_seconds() < COOLDOWN_SECONDS:
            await db.rollback()
            punch_type = "OUT" if time_record.logout_time is None else "IN"
            raise HTTPException(
                status_code=429,
                detail=f"Already punched {'in' if punch_type == 'OUT' else 'out'} recently. Please wait {COOLDOWN_SECONDS} seconds between scans."
            )
    
    message = ""
    session_info = {}
    
    if not time_record or time_record.logout_time is not None:
        # Case A: Punch In — no record yet OR latest session already completed → start new session
        session_number = len(today_records) + 1
        time_record = TimeTracking(
            user_id=user.id,
            date=datetime.combine(today, time.min),
            login_time=now
        )
        db.add(time_record)
        
        message = f"Punch In successful! Session #{session_number} started."
        session_info = {
            "punch_type": "IN",
            "login_time": now.isoformat(),
            "date": today.isoformat(),
            "user_name": user.name,
            "role": role_val,
            "user_id": user.id,
            "session_number": session_number
        }
    else:
        # Case B: Punch Out — latest session is open
        session_number = len(today_records)
        time_record.logout_time = now
        diff = now - time_record.login_time
        time_record.total_minutes = int(diff.total_seconds() / 60)
        
        hours = time_record.total_minutes // 60
        mins = time_record.total_minutes % 60
        duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
            
        message = f"Punch Out successful! Session #{session_number} Duration: {duration_str}."
        session_info = {
            "punch_type": "OUT",
            "login_time": time_record.login_time.isoformat(),
            "logout_time": now.isoformat(),
            "total_minutes": time_record.total_minutes,
            "duration": duration_str,
            "date": today.isoformat(),
            "user_name": user.name,
            "role": role_val,
            "user_id": user.id,
            "session_number": session_number
        }
        
    await db.commit()

    # --- If this scan was from a batch-specific QR, mark the student PRESENT in the Attendance table ---
    # The trainer attendance page reads from Attendance (not TimeTracking), so we must update both.
    # A batch-specific QR has a base64 JSON payload with "b" (batch_id) and "d" (date) fields.
    # The global QR is just a plain UUID secret string — no JSON payload.
    try:
        from app.models.attendance import Attendance, AttendanceStatus
        from app.models.course import BatchStudent

        padded = token + '=' * (-len(token) % 4)
        decoded_bytes = base64.b64decode(padded)
        qr_payload = json.loads(decoded_bytes.decode())
        batch_id = qr_payload.get("b")
        qr_date_str = qr_payload.get("d")

        if batch_id and qr_date_str:
            # Verify the student belongs to this batch
            bs_check = await db.execute(
                select(BatchStudent).where(
                    BatchStudent.batch_id == batch_id,
                    BatchStudent.student_id == user.id
                )
            )
            if bs_check.scalars().first():
                qr_date = datetime.strptime(qr_date_str, "%Y-%m-%d")
                # Upsert: check existing attendance for this student/batch/date
                existing = await db.execute(
                    select(Attendance).where(
                        Attendance.student_id == user.id,
                        Attendance.batch_id == batch_id,
                        func.date(Attendance.date) == qr_date.date()
                    )
                )
                att = existing.scalars().first()
                if att:
                    # Update to PRESENT if currently ABSENT (don't downgrade LATE/ON_LEAVE)
                    if att.status == AttendanceStatus.ABSENT:
                        att.status = AttendanceStatus.PRESENT
                else:
                    att = Attendance(
                        student_id=user.id,
                        batch_id=batch_id,
                        date=qr_date,
                        status=AttendanceStatus.PRESENT,
                        remarks=f"QR scan auto-marked at {now.strftime('%H:%M')}"
                    )
                    db.add(att)
                await db.commit()
                session_info["batch_id"] = batch_id
                session_info["attendance_marked"] = True
    except Exception:
        pass  # QR was global secret or unparseable — no attendance marking needed

    return {"status": "success", "message": message, "session_info": session_info}


# ─── Suggestion Box ────────────────────────────────────────
@router.post("/suggestions", status_code=201)
async def submit_suggestion(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.notification import Suggestion
    msg = (body.get("message") or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(msg) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 chars).")

    is_anon = bool(body.get("is_anonymous", False))
    s = Suggestion(
        student_id=None if is_anon else user.id,
        message=msg,
        category=body.get("category") or "General",
        is_anonymous=is_anon,
        screenshot_base64=body.get("screenshot_base64")
    )
    db.add(s)
    await db.commit()
    return {"status": "submitted", "message": "Thank you for your suggestion!"}


# ─── Push Notifications Subscribe ──────────────────────────
@router.post("/subscribe", status_code=201)
async def subscribe_push(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.notification import PushSubscription
    endpoint = body.get("endpoint")
    keys = body.get("keys", {})
    p256dh = keys.get("p256dh")
    auth_secret = keys.get("auth")

    if not endpoint or not p256dh or not auth_secret:
        raise HTTPException(status_code=400, detail="Invalid subscription payload")

    # Check if subscription already exists
    res = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    existing = res.scalars().first()

    if existing:
        if existing.user_id != user.id:
            existing.user_id = user.id
            await db.commit()
        return {"status": "updated"}

    # Create new subscription
    sub = PushSubscription(
        user_id=user.id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth_secret,
        device_type=body.get("device_type", "Unknown")
    )
    db.add(sub)
    await db.commit()
    return {"status": "subscribed"}
