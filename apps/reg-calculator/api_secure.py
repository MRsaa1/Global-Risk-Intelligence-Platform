"""
Secure Production API for reg-calculator service
Enhanced with security, stability, and monitoring
"""

import os
import sys
import signal
import logging
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError
import uvicorn
from datetime import datetime, timedelta
import jwt
import time
import resource

# Configure logging
logging.basicConfig(
    level=logging.INFO if os.getenv('LOG_LEVEL', 'INFO') == 'INFO' else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)

# Security
JWT_SECRET = os.getenv('JWT_SECRET', '')
if not JWT_SECRET or len(JWT_SECRET) < 32:
    logger.error('JWT_SECRET must be set and at least 32 characters')
    sys.exit(1)

ALLOWED_ORIGINS = os.getenv('CORS_ORIGINS', '').split(',') if os.getenv('CORS_ORIGINS') else ['*']
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'

# Rate limiting storage (in production, use Redis)
rate_limit_store: dict[str, list[float]] = {}

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Verify JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

def rate_limit(request: Request, max_requests: int = 100, window: int = 60):
    """Simple rate limiting middleware"""
    if not RATE_LIMIT_ENABLED:
        return
    
    client_ip = request.client.host if request.client else 'unknown'
    now = time.time()
    
    # Clean old entries
    if client_ip in rate_limit_store:
        rate_limit_store[client_ip] = [
            timestamp for timestamp in rate_limit_store[client_ip]
            if now - timestamp < window
        ]
    else:
        rate_limit_store[client_ip] = []
    
    # Check rate limit
    if len(rate_limit_store[client_ip]) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail=f'Rate limit exceeded. Max {max_requests} requests per {window} seconds'
        )
    
    rate_limit_store[client_ip].append(now)

# Graceful shutdown
shutdown_event = None

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f'Received signal {signum}, initiating graceful shutdown...')
    global shutdown_event
    if shutdown_event:
        shutdown_event.set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global shutdown_event
    import asyncio
    shutdown_event = asyncio.Event()
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    logger.info('Starting reg-calculator API...')
    yield
    
    logger.info('Shutting down reg-calculator API...')
    if shutdown_event:
        shutdown_event.set()

# Create FastAPI app
app = FastAPI(
    title='Reg Calculator API',
    description='Regulatory calculation engine API',
    version='1.0.0',
    lifespan=lifespan,
    docs_url='/docs' if os.getenv('ENABLE_DOCS', 'false').lower() == 'true' else None,
    redoc_url=None,
)

# Security: Trusted Host
if os.getenv('TRUSTED_HOSTS'):
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=os.getenv('TRUSTED_HOSTS', '').split(',')
    )

# Security: CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['Content-Type', 'Authorization', 'X-Request-ID'],
    expose_headers=['X-Request-ID'],
)

# Request ID middleware
@app.middleware('http')
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get('X-Request-ID') or f'req-{int(time.time() * 1000)}-{os.urandom(4).hex()}'
    response = await call_next(request)
    response.headers['X-Request-ID'] = request_id
    return response

# Rate limiting middleware
@app.middleware('http')
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for health checks
    if request.url.path != '/health':
        rate_limit(request)
    return await call_next(request)

# Error handlers
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={'error': 'Validation error', 'details': exc.errors()}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={'error': exc.detail, 'statusCode': exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f'Unhandled exception: {exc}', exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            'error': 'Internal server error',
            'statusCode': 500,
        }
    )

# Health check
@app.get('/health')
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime': time.time() - start_time,
        'version': '1.0.0',
    }

@app.get('/health/detailed')
async def detailed_health_check():
    """Detailed health check for monitoring"""
    import os
    import resource
    
    # Get memory usage using resource module (built-in)
    try:
        memory_info = resource.getrusage(resource.RUSAGE_SELF)
        rss_mb = round(memory_info.ru_maxrss / 1024, 2)  # On Linux, this is in KB
    except:
        rss_mb = 0
    
    return {
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime': time.time() - start_time,
        'memory': {
            'rss_mb': rss_mb,
        },
        'version': '1.0.0',
    }

# Request models
class CalculationRequest(BaseModel):
    scenario_id: str = Field(..., min_length=1, max_length=100)
    portfolio_id: str = Field(..., min_length=1, max_length=100)
    parameters: Optional[dict] = None

# Protected endpoints
@app.post('/api/v1/calculate')
async def calculate(
    request: CalculationRequest,
    user: dict = Depends(verify_token)
):
    """Run calculation (protected)"""
    logger.info(f'Calculation request from user {user.get("username")}: {request.scenario_id}')
    
    return {
        'calculation_id': f'calc_{int(time.time() * 1000)}',
        'scenario_id': request.scenario_id,
        'portfolio_id': request.portfolio_id,
        'status': 'running',
        'created_at': datetime.utcnow().isoformat(),
    }

@app.get('/api/v1/calculations/{calculation_id}')
async def get_calculation(
    calculation_id: str,
    user: dict = Depends(verify_token)
):
    """Get calculation status (protected)"""
    return {
        'calculation_id': calculation_id,
        'status': 'completed',
        'results': {
            'basel_iv_calc': {
                'cet1_ratio': 0.125,
                'capital_requirement': 8000000,
            },
        },
    }

start_time = time.time()

if __name__ == '__main__':
    port = int(os.getenv('PORT', '8080'))
    host = os.getenv('HOST', '0.0.0.0')
    
    uvicorn.run(
        'api_secure:app',
        host=host,
        port=port,
        log_level=os.getenv('LOG_LEVEL', 'info').lower(),
        access_log=True,
    )

