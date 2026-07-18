"""Rate limiting middleware"""

import time
from typing import Dict, Tuple
from collections import defaultdict, deque
from fastapi import Request, HTTPException, status
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Simple in-memory rate limiter using sliding window algorithm

    For production, consider using Redis-based rate limiting for:
    - Distributed rate limiting across multiple servers
    - Persistent rate limit counters
    - More sophisticated algorithms (token bucket, leaky bucket)
    """

    def __init__(self, requests_per_minute: int = 10):
        """
        Initialize rate limiter

        Args:
            requests_per_minute: Maximum requests allowed per minute per IP
        """
        self.requests_per_minute = requests_per_minute
        self.window_size = 60  # seconds
        # Store: {ip_address: deque of request timestamps}
        self.request_history: Dict[str, deque] = defaultdict(lambda: deque())

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        # Check X-Forwarded-For header (for proxies/load balancers)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # X-Forwarded-For can be a comma-separated list
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"

    def _clean_old_requests(self, ip: str, current_time: float):
        """Remove requests older than the time window"""
        cutoff_time = current_time - self.window_size
        history = self.request_history[ip]

        # Remove old requests from the front of the deque
        while history and history[0] < cutoff_time:
            history.popleft()

    def check_rate_limit(self, request: Request) -> Tuple[bool, dict]:
        """
        Check if request is within rate limit

        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        if not settings.RATE_LIMIT_ENABLED:
            return True, {}

        ip = self._get_client_ip(request)
        current_time = time.time()

        # Clean old requests
        self._clean_old_requests(ip, current_time)

        # Get current request count
        history = self.request_history[ip]
        request_count = len(history)

        # Check if limit exceeded
        is_allowed = request_count < self.requests_per_minute

        # Calculate rate limit info
        rate_limit_info = {
            "limit": self.requests_per_minute,
            "remaining": max(0, self.requests_per_minute - request_count),
            "used": request_count,
            "reset": int(current_time + self.window_size),
        }

        if is_allowed:
            # Add current request to history
            history.append(current_time)

        return is_allowed, rate_limit_info

    def get_retry_after(self, ip: str) -> int:
        """Get seconds until rate limit resets for an IP"""
        history = self.request_history.get(ip)
        if not history:
            return 0

        current_time = time.time()
        oldest_request = history[0]
        retry_after = int(self.window_size - (current_time - oldest_request))

        return max(0, retry_after)


# Global rate limiter instance
rate_limiter = RateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE)


async def check_rate_limit(request: Request):
    """
    FastAPI dependency to check rate limits

    Usage:
        @app.get("/api/endpoint", dependencies=[Depends(check_rate_limit)])
        async def my_endpoint():
            ...
    """
    is_allowed, rate_limit_info = rate_limiter.check_rate_limit(request)

    # Add rate limit headers to response
    # Note: FastAPI doesn't have direct response access in dependencies,
    # so we'll handle this in the middleware instead

    if not is_allowed:
        ip = rate_limiter._get_client_ip(request)
        retry_after = rate_limiter.get_retry_after(ip)

        logger.warning(
            f"Rate limit exceeded for {ip} on {request.url.path}. "
            f"Used: {rate_limit_info['used']}/{rate_limit_info['limit']}"
        )

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(rate_limit_info["limit"]),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(rate_limit_info["reset"]),
            },
        )

    return rate_limit_info


class RateLimitMiddleware:
    """
    Middleware to add rate limit headers to all responses

    This adds rate limit information to response headers even for successful requests
    """

    def __init__(self, app, limiter: RateLimiter):
        self.app = app
        self.limiter = limiter

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Create request object
        request = Request(scope, receive)

        # Check rate limit
        is_allowed, rate_limit_info = self.limiter.check_rate_limit(request)

        if not is_allowed:
            # Rate limit exceeded - send 429 response
            ip = self.limiter._get_client_ip(request)
            retry_after = self.limiter.get_retry_after(ip)

            response_body = {
                "detail": f"Rate limit exceeded. Try again in {retry_after} seconds."
            }

            import json
            response_data = json.dumps(response_body).encode()

            async def send_with_rate_limit_error(message):
                if message["type"] == "http.response.start":
                    message["status"] = 429
                    message["headers"] = [
                        (b"content-type", b"application/json"),
                        (b"retry-after", str(retry_after).encode()),
                        (b"x-ratelimit-limit", str(rate_limit_info["limit"]).encode()),
                        (b"x-ratelimit-remaining", b"0"),
                        (b"x-ratelimit-reset", str(rate_limit_info["reset"]).encode()),
                    ]
                elif message["type"] == "http.response.body":
                    message["body"] = response_data

                await send(message)

            await send_with_rate_limit_error({"type": "http.response.start"})
            await send_with_rate_limit_error({"type": "http.response.body"})
            return

        # Add rate limit headers to successful responses
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend([
                    (b"x-ratelimit-limit", str(rate_limit_info["limit"]).encode()),
                    (b"x-ratelimit-remaining", str(rate_limit_info["remaining"]).encode()),
                    (b"x-ratelimit-reset", str(rate_limit_info["reset"]).encode()),
                ])
                message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_with_headers)
