from unittest.mock import AsyncMock, patch

import pytest

from app.services import notifier

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def reset_cooldown_state():
    """Each test starts with a clean cooldown tracker, since it's a
    module-level dict that would otherwise leak state between tests."""
    notifier._last_alert_sent.clear()
    yield
    notifier._last_alert_sent.clear()


async def test_no_alert_sent_when_unconfigured():
    with patch.object(notifier.settings, "SMTP_HOST", None), \
         patch.object(notifier.settings, "ALERT_WEBHOOK_URL", None), \
         patch.object(notifier, "_send_webhook", new=AsyncMock()) as mock_webhook:
        await notifier.notify_status_change("Test Device", "10.0.0.1", "online", "offline")
        mock_webhook.assert_not_called()


async def test_alert_sent_when_webhook_configured():
    with patch.object(notifier.settings, "SMTP_HOST", None), \
         patch.object(notifier.settings, "ALERT_WEBHOOK_URL", "https://example.com/webhook"), \
         patch.object(notifier, "_send_webhook", new=AsyncMock()) as mock_webhook:
        await notifier.notify_status_change("Test Device", "10.0.0.1", "online", "offline")
        mock_webhook.assert_called_once()


async def test_second_alert_within_cooldown_is_suppressed():
    with patch.object(notifier.settings, "SMTP_HOST", None), \
         patch.object(notifier.settings, "ALERT_WEBHOOK_URL", "https://example.com/webhook"), \
         patch.object(notifier.settings, "ALERT_COOLDOWN_SECONDS", 300), \
         patch.object(notifier, "_send_webhook", new=AsyncMock()) as mock_webhook:
        await notifier.notify_status_change("Flapping Device", "10.0.0.2", "online", "offline")
        await notifier.notify_status_change("Flapping Device", "10.0.0.2", "offline", "online")
        await notifier.notify_status_change("Flapping Device", "10.0.0.2", "online", "offline")

        # Three transitions in quick succession, but only the first should
        # have actually gone out — this is the exact "flapping device spam"
        # scenario the cooldown exists to prevent.
        assert mock_webhook.call_count == 1


async def test_alert_allowed_again_after_cooldown_expires():
    with patch.object(notifier.settings, "SMTP_HOST", None), \
         patch.object(notifier.settings, "ALERT_WEBHOOK_URL", "https://example.com/webhook"), \
         patch.object(notifier.settings, "ALERT_COOLDOWN_SECONDS", 0), \
         patch.object(notifier, "_send_webhook", new=AsyncMock()) as mock_webhook:
        await notifier.notify_status_change("Test Device", "10.0.0.3", "online", "offline")
        await notifier.notify_status_change("Test Device", "10.0.0.3", "offline", "online")

        # Cooldown set to 0 seconds -> every transition should go through
        assert mock_webhook.call_count == 2


async def test_different_devices_have_independent_cooldowns():
    with patch.object(notifier.settings, "SMTP_HOST", None), \
         patch.object(notifier.settings, "ALERT_WEBHOOK_URL", "https://example.com/webhook"), \
         patch.object(notifier.settings, "ALERT_COOLDOWN_SECONDS", 300), \
         patch.object(notifier, "_send_webhook", new=AsyncMock()) as mock_webhook:
        await notifier.notify_status_change("Device A", "10.0.0.4", "online", "offline")
        await notifier.notify_status_change("Device B", "10.0.0.5", "online", "offline")

        # Different devices (different ip_address keys) -> both go through,
        # cooldown is per-device, not global.
        assert mock_webhook.call_count == 2
