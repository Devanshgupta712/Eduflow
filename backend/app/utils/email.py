import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def send_verification_email(to_email: str, code: str):
    """Send verification code via SMTP."""
    subject = "Verify your Apptech Careers LMS account"
    
    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; padding: 20px; background-color: #f4f7f6;">
        <div style="background: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #0066ff; margin: 0; font-size: 28px; font-weight: 800;">Apptech Careers</h2>
                <p style="color: #64748b; margin-top: 5px; font-size: 16px;">Learning Management System</p>
            </div>
            
            <div style="border-top: 2px solid #f1f5f9; padding-top: 30px;">
                <p style="font-size: 16px; line-height: 1.6; color: #334155;">Hello,</p>
                <p style="font-size: 16px; line-height: 1.6; color: #334155;">Thank you for registering. Please use the following verification code to complete your account setup:</p>
                
                <div style="font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #0066ff; padding: 30px 0; text-align: center; background: #f8fafc; border-radius: 16px; margin: 25px 0;">
                    {code}
                </div>
                
                <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 20px;">
                    This code will expire in 24 hours.<br>
                    If you didn't request this, please ignore this email.
                </p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 Apptech Careers Software. All rights reserved.</p>
            </div>
        </div>
      </body>
    </html>
    """
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_SENDER
    msg["To"] = to_email
    
    msg.attach(MIMEText(f"Your verification code is: {code}", "plain"))
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        print(f"DEBUG: Attempting to send email to {to_email} via {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        print(f"DEBUG: Using sender: {settings.SMTP_SENDER}")
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.set_debuglevel(1)  # Enable debug output in logs
            server.starttls()
            print(f"DEBUG: Logging in as {settings.SMTP_USER}")
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        print(f"DEBUG: Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"DEBUG: Failed to send email to {to_email}: {str(e)}")
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
def send_leave_status_email(to_email: str, status: str, leave_details: dict, rejection_reason: str = None):
    """Notify student about leave approval/rejection."""
    subject = f"Leave Request {status.capitalize()}"
    
    status_color = "#10b981" if status == "APPROVED" else "#ef4444"
    
    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; padding: 20px; background-color: #f4f7f6;">
        <div style="background: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #0066ff; margin: 0; font-size: 28px; font-weight: 800;">Apptech Careers</h2>
            </div>
            
            <div style="border-top: 2px solid #f1f5f9; padding-top: 30px;">
                <p style="font-size: 16px; line-height: 1.6; color: #334155;">Hello,</p>
                <p style="font-size: 16px; line-height: 1.6; color: #334155;">Your leave request for <b>{leave_details.get('start_date')}</b> to <b>{leave_details.get('end_date')}</b> has been <span style="color: {status_color}; font-weight: bold;">{status}</span>.</p>
                
                {f'<p style="background: #fff5f5; border-left: 4px solid #fecaca; padding: 12px; color: #b91c1c; margin-top: 15px;"><b>Reason for rejection:</b> {rejection_reason}</p>' if rejection_reason else ''}

                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                    Log in to the LMS dashboard for more details.
                </p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 Apptech Careers Software. All rights reserved.</p>
            </div>
        </div>
      </body>
    </html>
    """
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_SENDER
    msg["To"] = to_email
    
    msg.attach(MIMEText(f"Your leave request has been {status}.", "plain"))
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Failed to send leave email to {to_email}: {e}")
        return False

def send_session_notification(to_email: str, session_title: str, start_time_str: str):
    """Notify student about a newly scheduled session."""
    subject = f"New Session Scheduled: {session_title}"
    
    html_content = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; padding: 20px; background-color: #f4f7f6;">
        <div style="background: #ffffff; padding: 40px; border-radius: 24px; border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #0066ff; margin: 0; font-size: 28px; font-weight: 800;">Apptech Careers</h2>
                <p style="color: #64748b; margin-top: 5px; font-size: 16px;">New Class Schedule</p>
            </div>
            
            <div style="border-top: 2px solid #f1f5f9; padding-top: 30px;">
                <p style="font-size: 16px; line-height: 1.6; color: #334155;">Hello,</p>
                <p style="font-size: 16px; line-height: 1.6; color: #334155;">A new training session has been scheduled for your batch:</p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #0066ff; font-weight: bold; font-size: 18px;">{session_title}</p>
                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">📅 {start_time_str}</p>
                </div>

                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                    Please log in to your LMS dashboard to join the class when it starts.
                </p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 Apptech Careers Software. All rights reserved.</p>
            </div>
        </div>
      </body>
    </html>
    """
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_SENDER
    msg["To"] = to_email
    
    msg.attach(MIMEText(f"A new session '{session_title}' has been scheduled for {start_time_str}.", "plain"))
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Failed to send session email to {to_email}: {e}")
        return False
