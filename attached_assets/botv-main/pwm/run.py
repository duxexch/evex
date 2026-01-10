#!/usr/bin/env python
"""Script to run PWM API"""

if __name__ == "__main__":
    import uvicorn
    from pwm.backend.core.config import get_settings
    
    settings = get_settings()
    
    uvicorn.run(
        "pwm.backend.main:app",
        host="0.0.0.0",
        port=settings.api_port,
        reload=(settings.environment == "development"),
        log_level=settings.log_level.lower(),
    )
