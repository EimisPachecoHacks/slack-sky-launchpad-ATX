"""Tests for middleware (auth, rate limiting, file validation)"""

import pytest
import jwt
import time
import io
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from fastapi import HTTPException, status, Request, UploadFile
from backend.middleware.auth import (
    verify_api_key,
    verify_jwt_token,
    verify_authentication,
    create_jwt_token,
    AuthenticationError
)
from backend.middleware.rate_limit import RateLimiter, check_rate_limit
from backend.middleware.file_validation import (
    validate_file_extension,
    validate_file_size,
    detect_mime_type,
    validate_mime_vs_extension,
    sanitize_filename,
    validate_upload_file,
    FileValidationError
)


class TestAuthMiddleware:
    """Test authentication middleware"""

    def test_authentication_error_structure(self):
        """Test AuthenticationError has correct structure"""
        error = AuthenticationError("Test error")

        assert error.status_code == status.HTTP_401_UNAUTHORIZED
        assert error.detail == "Test error"
        assert "WWW-Authenticate" in error.headers

    @pytest.mark.asyncio
    async def test_verify_api_key_no_keys_configured(self):
        """Test API key verification when no keys are configured"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.get_api_keys.return_value = []

            result = await verify_api_key(api_key=None)
            assert result is None

    @pytest.mark.asyncio
    async def test_verify_api_key_missing_when_required(self):
        """Test API key verification fails when required but not provided"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.get_api_keys.return_value = ["valid-key-123"]

            with pytest.raises(AuthenticationError, match="API key required"):
                await verify_api_key(api_key=None)

    @pytest.mark.asyncio
    async def test_verify_api_key_invalid(self):
        """Test API key verification fails with invalid key"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.get_api_keys.return_value = ["valid-key-123"]

            with pytest.raises(AuthenticationError, match="Invalid API key"):
                await verify_api_key(api_key="wrong-key")

    @pytest.mark.asyncio
    async def test_verify_api_key_valid(self):
        """Test API key verification succeeds with valid key"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.get_api_keys.return_value = ["valid-key-123"]

            result = await verify_api_key(api_key="valid-key-123")
            assert result == "valid-key-123"

    @pytest.mark.asyncio
    async def test_verify_jwt_no_secret_configured(self):
        """Test JWT verification when no secret is configured"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = None

            result = await verify_jwt_token(credentials=None)
            assert result is None

    @pytest.mark.asyncio
    async def test_verify_jwt_missing_when_required(self):
        """Test JWT verification fails when required but not provided"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = "test-secret"

            with pytest.raises(AuthenticationError, match="JWT token required"):
                await verify_jwt_token(credentials=None)

    @pytest.mark.asyncio
    async def test_verify_jwt_expired_token(self):
        """Test JWT verification fails with expired token"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = "test-secret"
            mock_settings.JWT_ALGORITHM = "HS256"

            # Create expired token
            expired_token = jwt.encode(
                {"sub": "user123", "exp": int(time.time()) - 3600},
                "test-secret",
                algorithm="HS256"
            )

            mock_credentials = Mock()
            mock_credentials.credentials = expired_token

            with pytest.raises(AuthenticationError, match="Token has expired"):
                await verify_jwt_token(credentials=mock_credentials)

    @pytest.mark.asyncio
    async def test_verify_jwt_invalid_token(self):
        """Test JWT verification fails with invalid token"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = "test-secret"
            mock_settings.JWT_ALGORITHM = "HS256"

            mock_credentials = Mock()
            mock_credentials.credentials = "invalid.jwt.token"

            with pytest.raises(AuthenticationError, match="Invalid token"):
                await verify_jwt_token(credentials=mock_credentials)

    @pytest.mark.asyncio
    async def test_verify_jwt_valid_token(self):
        """Test JWT verification succeeds with valid token"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = "test-secret"
            mock_settings.JWT_ALGORITHM = "HS256"

            # Create valid token
            valid_token = jwt.encode(
                {"sub": "user123", "email": "user@example.com", "exp": int(time.time()) + 3600},
                "test-secret",
                algorithm="HS256"
            )

            mock_credentials = Mock()
            mock_credentials.credentials = valid_token

            result = await verify_jwt_token(credentials=mock_credentials)
            assert result["sub"] == "user123"
            assert result["email"] == "user@example.com"

    def test_create_jwt_token_success(self):
        """Test JWT token creation"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = "test-secret"
            mock_settings.JWT_ALGORITHM = "HS256"

            token = create_jwt_token("user123", "user@test.com", expires_in=3600)

            # Decode to verify
            payload = jwt.decode(token, "test-secret", algorithms=["HS256"])
            assert payload["sub"] == "user123"
            assert payload["email"] == "user@test.com"
            assert "iat" in payload
            assert "exp" in payload

    def test_create_jwt_token_no_secret(self):
        """Test JWT token creation fails without secret"""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.JWT_SECRET_KEY = None

            with pytest.raises(ValueError, match="JWT_SECRET_KEY not configured"):
                create_jwt_token("user123", "user@test.com")

    @pytest.mark.asyncio
    async def test_verify_authentication_development_mode(self):
        """Test authentication allows access in development mode"""
        mock_request = Mock(spec=Request)
        mock_request.url.path = "/api/test"

        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.is_development = True
            mock_settings.API_KEYS = None
            mock_settings.JWT_SECRET_KEY = None

            result = await verify_authentication(mock_request, api_key=None, jwt_payload=None)

            assert result["authenticated"] is False
            assert result["mode"] == "development"


class TestRateLimitMiddleware:
    """Test rate limiting middleware"""

    def test_rate_limiter_initialization(self):
        """Test rate limiter initializes correctly"""
        limiter = RateLimiter(requests_per_minute=10)

        assert limiter.requests_per_minute == 10
        assert limiter.window_size == 60
        assert isinstance(limiter.request_history, dict)

    def test_get_client_ip_from_x_forwarded_for(self):
        """Test client IP extraction from X-Forwarded-For header"""
        limiter = RateLimiter()

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(side_effect=lambda k: "1.2.3.4, 5.6.7.8" if k == "X-Forwarded-For" else None)
        mock_request.client = None

        ip = limiter._get_client_ip(mock_request)
        assert ip == "1.2.3.4"

    def test_get_client_ip_from_x_real_ip(self):
        """Test client IP extraction from X-Real-IP header"""
        limiter = RateLimiter()

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(side_effect=lambda k: "1.2.3.4" if k == "X-Real-IP" else None)
        mock_request.client = None

        ip = limiter._get_client_ip(mock_request)
        assert ip == "1.2.3.4"

    def test_get_client_ip_from_client(self):
        """Test client IP extraction from request.client"""
        limiter = RateLimiter()

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(return_value=None)
        mock_request.client.host = "1.2.3.4"

        ip = limiter._get_client_ip(mock_request)
        assert ip == "1.2.3.4"

    def test_rate_limit_allows_under_limit(self):
        """Test rate limiter allows requests under limit"""
        limiter = RateLimiter(requests_per_minute=10)

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(return_value=None)
        mock_request.client.host = "1.2.3.4"

        with patch("backend.middleware.rate_limit.settings") as mock_settings:
            mock_settings.RATE_LIMIT_ENABLED = True

            # Make 5 requests (under limit of 10)
            for _ in range(5):
                is_allowed, info = limiter.check_rate_limit(mock_request)
                assert is_allowed is True

            # Check remaining count
            _, info = limiter.check_rate_limit(mock_request)
            assert info["remaining"] < 10

    def test_rate_limit_blocks_over_limit(self):
        """Test rate limiter blocks requests over limit"""
        limiter = RateLimiter(requests_per_minute=5)

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(return_value=None)
        mock_request.client.host = "1.2.3.4"

        with patch("backend.middleware.rate_limit.settings") as mock_settings:
            mock_settings.RATE_LIMIT_ENABLED = True

            # Make exactly the limit number of requests
            for _ in range(5):
                is_allowed, _ = limiter.check_rate_limit(mock_request)
                assert is_allowed is True

            # Next request should be blocked
            is_allowed, info = limiter.check_rate_limit(mock_request)
            assert is_allowed is False
            assert info["remaining"] == 0

    def test_rate_limit_disabled(self):
        """Test rate limiter when disabled"""
        limiter = RateLimiter(requests_per_minute=1)

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(return_value=None)
        mock_request.client.host = "1.2.3.4"

        with patch("backend.middleware.rate_limit.settings") as mock_settings:
            mock_settings.RATE_LIMIT_ENABLED = False

            # Should allow unlimited requests
            for _ in range(100):
                is_allowed, _ = limiter.check_rate_limit(mock_request)
                assert is_allowed is True

    def test_rate_limit_cleanup_old_requests(self):
        """Test that old requests are cleaned up"""
        limiter = RateLimiter(requests_per_minute=10)

        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(return_value=None)
        mock_request.client.host = "1.2.3.4"

        # Add old request manually
        old_time = time.time() - 120  # 2 minutes ago
        limiter.request_history["1.2.3.4"].append(old_time)

        # Clean old requests
        current_time = time.time()
        limiter._clean_old_requests("1.2.3.4", current_time)

        # Old request should be removed
        assert old_time not in limiter.request_history["1.2.3.4"]

    def test_get_retry_after(self):
        """Test retry_after calculation"""
        limiter = RateLimiter(requests_per_minute=10)

        # Add a recent request
        recent_time = time.time() - 30  # 30 seconds ago
        limiter.request_history["1.2.3.4"].append(recent_time)

        retry_after = limiter.get_retry_after("1.2.3.4")

        # Should be around 30 seconds (60 - 30)
        assert 25 <= retry_after <= 35

    @pytest.mark.asyncio
    async def test_check_rate_limit_dependency_blocks(self):
        """Test rate limit dependency blocks excessive requests"""
        mock_request = Mock(spec=Request)
        mock_request.headers.get = Mock(return_value=None)
        mock_request.client.host = "1.2.3.4"
        mock_request.url.path = "/api/test"

        # Create a limiter with very low limit
        with patch("backend.middleware.rate_limit.rate_limiter") as mock_limiter:
            mock_limiter.check_rate_limit.return_value = (False, {
                "limit": 1,
                "remaining": 0,
                "used": 1,
                "reset": int(time.time() + 60)
            })
            mock_limiter._get_client_ip.return_value = "1.2.3.4"
            mock_limiter.get_retry_after.return_value = 30

            with pytest.raises(HTTPException) as exc_info:
                await check_rate_limit(mock_request)

            assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
            assert "Retry-After" in exc_info.value.headers


class TestFileValidationMiddleware:
    """Test file validation middleware"""

    def test_validate_file_extension_valid(self):
        """Test file extension validation with valid extension"""
        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.get_allowed_extensions.return_value = [".png", ".jpg", ".pdf"]

            ext = validate_file_extension("test.png")
            assert ext == ".png"

    def test_validate_file_extension_invalid(self):
        """Test file extension validation with invalid extension"""
        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.get_allowed_extensions.return_value = [".png", ".jpg"]

            with pytest.raises(FileValidationError, match="not allowed"):
                validate_file_extension("test.exe")

    def test_validate_file_extension_empty_filename(self):
        """Test file extension validation with empty filename"""
        with pytest.raises(FileValidationError, match="Filename is required"):
            validate_file_extension("")

    def test_validate_file_size_valid(self):
        """Test file size validation with valid size"""
        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.MAX_UPLOAD_SIZE_MB = 10

            # 5 MB file (should pass)
            validate_file_size(5 * 1024 * 1024)

    def test_validate_file_size_too_large(self):
        """Test file size validation with file too large"""
        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.MAX_UPLOAD_SIZE_MB = 10

            # 15 MB file (should fail)
            with pytest.raises(FileValidationError, match="exceeds maximum"):
                validate_file_size(15 * 1024 * 1024)

    def test_detect_mime_type_png(self):
        """Test MIME type detection for PNG"""
        png_signature = b"\x89PNG\r\n\x1a\n" + b"test data"

        mime_type = detect_mime_type(png_signature, "test.png")
        assert mime_type == "image/png"

    def test_detect_mime_type_jpeg(self):
        """Test MIME type detection for JPEG"""
        jpeg_signature = b"\xff\xd8\xff" + b"test data"

        mime_type = detect_mime_type(jpeg_signature, "test.jpg")
        assert mime_type == "image/jpeg"

    def test_detect_mime_type_pdf(self):
        """Test MIME type detection for PDF"""
        pdf_signature = b"%PDF-1.4" + b"test data"

        mime_type = detect_mime_type(pdf_signature, "test.pdf")
        assert mime_type == "application/pdf"

    def test_detect_mime_type_unknown(self):
        """Test MIME type detection with unknown file"""
        unknown_data = b"random binary data"

        with pytest.raises(FileValidationError, match="not allowed"):
            detect_mime_type(unknown_data, "test.unknown")

    def test_validate_mime_vs_extension_match(self):
        """Test MIME type vs extension validation when they match"""
        # PNG file with .png extension (should pass)
        validate_mime_vs_extension("image/png", ".png")

    def test_validate_mime_vs_extension_mismatch(self):
        """Test MIME type vs extension validation when they don't match"""
        # PNG file with .pdf extension (should fail - polyglot attack)
        with pytest.raises(FileValidationError, match="does not match"):
            validate_mime_vs_extension("image/png", ".pdf")

    def test_sanitize_filename_normal(self):
        """Test filename sanitization with normal filename"""
        sanitized = sanitize_filename("my_file.png")
        assert sanitized == "my_file.png"

    def test_sanitize_filename_dangerous_chars(self):
        """Test filename sanitization removes dangerous characters"""
        sanitized = sanitize_filename("my<>file:name|.png")
        assert "<" not in sanitized
        assert ">" not in sanitized
        assert ":" not in sanitized
        assert "|" not in sanitized

    def test_sanitize_filename_directory_traversal(self):
        """Test filename sanitization prevents directory traversal"""
        sanitized = sanitize_filename("../../etc/passwd")
        assert ".." not in sanitized
        assert "/" not in sanitized
        assert sanitized == "passwd"

    def test_sanitize_filename_hidden_files(self):
        """Test filename sanitization removes leading dots"""
        sanitized = sanitize_filename("..hidden.txt")
        assert not sanitized.startswith(".")

    def test_sanitize_filename_too_long(self):
        """Test filename sanitization truncates long names"""
        long_name = "a" * 300 + ".png"
        sanitized = sanitize_filename(long_name)
        assert len(sanitized) <= 255

    def test_sanitize_filename_empty_result(self):
        """Test filename sanitization handles empty result"""
        sanitized = sanitize_filename("...")
        assert sanitized == "uploaded_file"

    @pytest.mark.asyncio
    async def test_validate_upload_file_success(self):
        """Test successful file upload validation"""
        # Create a mock PNG file
        png_data = b"\x89PNG\r\n\x1a\n" + b"fake png data" * 100

        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.png"
        mock_file.read = AsyncMock(return_value=png_data)
        mock_file.seek = AsyncMock()

        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.get_allowed_extensions.return_value = [".png", ".jpg"]
            mock_settings.MAX_UPLOAD_SIZE_MB = 10

            ext, mime, content = await validate_upload_file(mock_file)

            assert ext == ".png"
            assert mime == "image/png"
            assert content == png_data

    @pytest.mark.asyncio
    async def test_validate_upload_file_no_filename(self):
        """Test file upload validation fails without filename"""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = None

        with pytest.raises(FileValidationError, match="Filename is required"):
            await validate_upload_file(mock_file)

    @pytest.mark.asyncio
    async def test_validate_upload_file_wrong_extension(self):
        """Test file upload validation fails with wrong extension"""
        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.exe"

        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.get_allowed_extensions.return_value = [".png", ".jpg"]

            with pytest.raises(FileValidationError, match="not allowed"):
                await validate_upload_file(mock_file)

    @pytest.mark.asyncio
    async def test_validate_upload_file_too_large(self):
        """Test file upload validation fails with file too large"""
        large_data = b"x" * (15 * 1024 * 1024)  # 15 MB

        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "test.png"
        mock_file.read = AsyncMock(return_value=large_data)

        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.get_allowed_extensions.return_value = [".png"]
            mock_settings.MAX_UPLOAD_SIZE_MB = 10

            with pytest.raises(FileValidationError, match="exceeds maximum"):
                await validate_upload_file(mock_file)

    @pytest.mark.asyncio
    async def test_validate_upload_file_polyglot_attack(self):
        """Test file upload validation detects polyglot files"""
        # PNG data with .pdf extension (polyglot attack)
        png_data = b"\x89PNG\r\n\x1a\n" + b"fake png"

        mock_file = Mock(spec=UploadFile)
        mock_file.filename = "malicious.pdf"
        mock_file.read = AsyncMock(return_value=png_data)

        with patch("backend.middleware.file_validation.settings") as mock_settings:
            mock_settings.get_allowed_extensions.return_value = [".png", ".pdf"]
            mock_settings.MAX_UPLOAD_SIZE_MB = 10

            with pytest.raises(FileValidationError, match="does not match"):
                await validate_upload_file(mock_file)
