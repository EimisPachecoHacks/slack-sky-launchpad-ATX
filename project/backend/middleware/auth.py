"""Authentication middleware"""

import os
import jwt
from typing import Optional
from fastapi import Security, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

# Security schemes
security_bearer = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name=settings.API_KEY_HEADER, auto_error=False)


class AuthenticationError(HTTPException):
    """Custom authentication error"""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> Optional[str]:
    """
    Verify API key from header

    Returns API key if valid, None if no API keys configured
    """
    # If no API keys are configured, skip API key authentication
    valid_api_keys = settings.get_api_keys()
    if not valid_api_keys:
        return None

    # If API keys are configured but none provided
    if not api_key:
        raise AuthenticationError("API key required. Provide via X-API-Key header.")

    # Verify API key
    if api_key not in valid_api_keys:
        logger.warning(f"Invalid API key attempt: {api_key[:8]}...")
        raise AuthenticationError("Invalid API key")

    return api_key


async def verify_jwt_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> Optional[dict]:
    """
    Verify JWT token from Authorization header

    Returns decoded token payload if valid, None if no JWT secret configured
    """
    # If no JWT secret is configured, skip JWT authentication
    if not settings.JWT_SECRET_KEY:
        return None

    # If JWT is configured but no token provided
    if not credentials:
        raise AuthenticationError("JWT token required. Provide via Authorization: Bearer header.")

    token = credentials.credentials

    try:
        # Decode and verify JWT
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {str(e)}")
        raise AuthenticationError("Invalid token")


async def verify_authentication(
    request: Request,
    api_key: Optional[str] = Security(verify_api_key),
    jwt_payload: Optional[dict] = Security(verify_jwt_token)
) -> dict:
    """
    Verify authentication using either API key or JWT token

    This is a flexible authentication that supports:
    - API key authentication (for service-to-service)
    - JWT token authentication (for user sessions)
    - No authentication if neither is configured (development mode)

    Returns authentication context with user/service information
    """
    # Development mode: Allow unauthenticated access
    if settings.is_development and not settings.API_KEYS and not settings.JWT_SECRET_KEY:
        logger.debug(f"Development mode: Allowing unauthenticated access to {request.url.path}")
        return {
            "authenticated": False,
            "mode": "development",
            "user": None
        }

    # Production mode: Require authentication
    if not api_key and not jwt_payload:
        raise AuthenticationError(
            "Authentication required. Provide either API key (X-API-Key header) "
            "or JWT token (Authorization: Bearer header)."
        )

    # API key authentication
    if api_key:
        return {
            "authenticated": True,
            "mode": "api_key",
            "user": None,
            "service": "api_key_client"
        }

    # JWT authentication
    if jwt_payload:
        return {
            "authenticated": True,
            "mode": "jwt",
            "user": jwt_payload.get("sub"),  # User ID from token
            "email": jwt_payload.get("email"),
            "payload": jwt_payload
        }

    # Should never reach here
    raise AuthenticationError("Authentication verification failed")


# Optional: Dependency for routes that require authentication
async def require_authentication(
    auth_context: dict = Security(verify_authentication)
) -> dict:
    """
    Dependency that requires authentication
    Use this for protected endpoints
    """
    if not auth_context.get("authenticated"):
        raise AuthenticationError("Authentication required")
    return auth_context


# Optional: Dependency for routes that are public but can use auth info if present
async def optional_authentication(
    request: Request,
    api_key: Optional[str] = Security(verify_api_key),
    jwt_payload: Optional[dict] = Security(verify_jwt_token)
) -> dict:
    """
    Dependency for routes that don't require authentication
    but can use auth info if provided
    """
    try:
        return await verify_authentication(request, api_key, jwt_payload)
    except AuthenticationError:
        return {
            "authenticated": False,
            "mode": "anonymous",
            "user": None
        }


def create_jwt_token(user_id: str, email: str, expires_in: int = 3600) -> str:
    """
    Create a JWT token for a user

    Args:
        user_id: User ID
        email: User email
        expires_in: Token expiration in seconds (default: 1 hour)

    Returns:
        JWT token string
    """
    import time

    if not settings.JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY not configured")

    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in,
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
