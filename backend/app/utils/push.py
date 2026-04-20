import json
import logging
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pywebpush import webpush, WebPushException
from app.config import settings

logger = logging.getLogger(__name__)

async def send_push_notification(user_id: str, title: str, message: str, link: str = "/"):
    from app.models.notification import PushSubscription
    from app.database import AsyncSessionLocal
    
    if not hasattr(settings, "VAPID_PRIVATE_KEY") or not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set. Cannot send push notification.")
        return

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))
        subscriptions = res.scalars().all()

        if not subscriptions:
            return

        payload = json.dumps({
            "title": title,
            "message": message,
            "link": link
        })

        vapid_claims = {"sub": getattr(settings, "VAPID_SUBJECT", "mailto:admin@edusuite.ai")}

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                }
                # webpush is synchronous, run in thread
                await asyncio.to_thread(
                    webpush,
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims=vapid_claims
                )
            except WebPushException as ex:
                logger.error(f"WebPushException for user {user_id}: {repr(ex)}")
                # If subscription is expired/invalid (404/410), remove it
                if ex.response is not None and ex.response.status_code in (404, 410):
                    await db.delete(sub)
                    await db.commit()
            except Exception as e:
                logger.error(f"Failed to send push to user {user_id}: {str(e)}")
