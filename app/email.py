from collections.abc import Callable

import httpx

from app.config import settings

RESEND_URL = "https://api.resend.com/emails"


class EmailFailed(Exception):
    pass


def send_login_code(to: str, code: str) -> None:
    try:
        response = httpx.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": f"Your overlap code: {code}",
                "text": (
                    f"Your overlap login code is {code}.\n\n"
                    "It expires in 10 minutes. If you didn't request it, you can ignore this email."
                ),
            },
        )
        response.raise_for_status()
    except httpx.HTTPError as e:
        raise EmailFailed from e


Mailer = Callable[[str, str], None]


def get_mailer() -> Mailer:
    return send_login_code
