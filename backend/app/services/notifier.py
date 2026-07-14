"""
Real alerting: email (SMTP) and/or webhook (e.g. Slack incoming webhook) on
device status changes.

Both channels are entirely optional and independently configurable via
environment variables (see backend/.env.example) — if neither is
configured, notify_status_change() logs at debug level and returns, so the
poller never breaks just because alerting isn't set up yet.

This is intentionally simple (no retry queue, no persistent rate-limit
store) — for a portfolio-scale project, "it actually sends a real
email/webhook, and doesn't spam on a flapping device" is the meaningful
claim. The cooldown tracker below is in-memory and per-process; it resets
on restart and wouldn't be shared across multiple worker processes if this
were ever scaled horizontally — a Redis-backed cooldown would be the
natural upgrade at that point, but is overkill for this project's scale.
"""

import logging
import smtplib
import time
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

logger = logging.getLogger("notifier")

# device ip_address -> monotonic timestamp of the last alert actually sent
_last_alert_sent: dict[str, float] = {}


def _send_email(subject: str, body: str) -> None:
    if not (settings.SMTP_HOST and settings.ALERT_EMAIL_TO and settings.SMTP_FROM_ADDRESS):
        return

    recipients = [addr.strip() for addr in settings.ALERT_EMAIL_TO.split(",") if addr.strip()]
    if not recipients:
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_ADDRESS
    msg["To"] = ", ".join(recipients)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
        server.starttls()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_ADDRESS, recipients, msg.as_string())

    logger.info("Sent email alert to %s: %s", recipients, subject)


async def _send_webhook(payload: dict) -> None:
    if not settings.ALERT_WEBHOOK_URL:
        return

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.post(settings.ALERT_WEBHOOK_URL, json=payload)
        response.raise_for_status()

    logger.info("Sent webhook alert to %s", settings.ALERT_WEBHOOK_URL)


async def notify_status_change(device_name: str, ip_address: str, previous_status: str, new_status: str) -> None:
    if not (settings.SMTP_HOST or settings.ALERT_WEBHOOK_URL):
        logger.debug("Alerting not configured — skipping notification for %s", device_name)
        return

    last_sent = _last_alert_sent.get(ip_address)
    if last_sent is not None and (time.monotonic() - last_sent) < settings.ALERT_COOLDOWN_SECONDS:
        logger.info(
            "Alert suppressed for %s (%s) — within %ss cooldown window",
            device_name,
            ip_address,
            settings.ALERT_COOLDOWN_SECONDS,
        )
        return

    subject = f"[Network Dashboard] {device_name} is now {new_status}"
    body = f"{device_name} ({ip_address}) changed from {previous_status} to {new_status}."

    _last_alert_sent[ip_address] = time.monotonic()

    if settings.SMTP_HOST:
        try:
            _send_email(subject, body)
        except Exception:
            logger.exception("Failed to send email alert for %s", device_name)

    if settings.ALERT_WEBHOOK_URL:
        try:
            # "text" works directly with Slack-compatible incoming webhooks;
            # harmless extra field for other webhook receivers.
            await _send_webhook(
                {
                    "text": f"{subject}\n{body}",
                    "device_name": device_name,
                    "ip_address": ip_address,
                    "previous_status": previous_status,
                    "new_status": new_status,
                }
            )
        except Exception:
            logger.exception("Failed to send webhook alert for %s", device_name)
