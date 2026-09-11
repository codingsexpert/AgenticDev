"""
src/routes/billing.py — Stripe Billing API Router
"""

import os
import time
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
import stripe

from src.guardrails.security_middleware import (
    global_rate_limiter,
    get_current_user_optional,
)
from src.routes.auth import load_users, save_users
from src.utils.memory_manager import save_user_profile

router = APIRouter(prefix="/api/billing", tags=["billing"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_mock")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_mock")
DOMAIN = os.getenv("FRONTEND_URL", "http://localhost:5173")


@router.post("/create-checkout")
async def create_checkout_session(user: Dict[str, Any] = Depends(get_current_user_optional)):
    if not user.get("authenticated"):
        raise HTTPException(status_code=401, detail="You must be logged in to buy tokens.")
    
    email = user.get("email", "").lower()
    
    # In dev mode with mock keys, just return a mock URL
    if stripe.api_key == "sk_test_mock":
        # Simulate payment success immediately for local testing
        users = load_users()
        if email in users:
            users[email]["token_budget"] = users[email].get("token_budget", 5.0) + 10.0
            save_users(users)
            save_user_profile(users[email])
        return {"url": f"{DOMAIN}?payment=mock_success"}

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=email,
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': 'AI Dev Team - 10 Tokens',
                            'description': 'Adds $10.00 to your LLM token budget',
                        },
                        'unit_amount': 1000,  # $10.00
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',
            success_url=f"{DOMAIN}?payment=success",
            cancel_url=f"{DOMAIN}?payment=cancelled",
            metadata={
                "user_email": email,
                "token_amount": "10.0"
            }
        )
        return {"url": checkout_session.url}
    except Exception as e:
        print(f"Stripe Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment session.")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")
    
    if stripe.api_key == "sk_test_mock":
        return JSONResponse(status_code=200, content={"status": "mocked webhook ignored"})

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        email = session.get("metadata", {}).get("user_email")
        added_budget = float(session.get("metadata", {}).get("token_amount", 0))

        if email and added_budget > 0:
            users = load_users()
            email_key = email.lower()
            if email_key in users:
                users[email_key]["token_budget"] = users[email_key].get("token_budget", 5.0) + added_budget
                save_users(users)
                save_user_profile(users[email_key])
                print(f"💰 Credited {added_budget} tokens to {email_key}")

    return JSONResponse(status_code=200, content={"status": "success"})
