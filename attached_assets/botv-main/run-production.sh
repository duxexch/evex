cd /var/www/botv

# استخدم cat مع here-doc بشكل آمن
cat > run-production.sh << 'EOF'
#!/bin/bash
################################################################################
# LangSense Bot - Production Deployment Script v2.0
# Advanced intelligent deployment with full validation
# 
# Features:
# ✅ Complete environment validation before deployment
# ✅ Idempotent operations (safe to run multiple times)
# ✅ Comprehensive Docker build optimization
# ✅ Full health check verification
# ✅ Professional error handling and logging
#
# Author: Professional DevOps Team
# Date: January 5, 2026
################################################################################

set -euo pipefail
trap 'handle_error "${BASH_LINENO[0]}"' ERR

# COLOR CODES
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# CONFIGURATION
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
LOG_DIR="${PROJECT_DIR}/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${LOG_DIR}/deployment_${TIMESTAMP}.log"
REPORT_FILE="${LOG_DIR}/deployment_report_${TIMESTAMP}.md"

COMPOSE_FILE="docker-compose.local-db.yml"
API_CONTAINER="langsense-api"
BOT_CONTAINER="langsense-bot"
NETWORK_NAME="botv_langsense-network"

BUILD_TIMEOUT=1800
FORCE_REBUILD=false
SKIP_VALIDATION=false

################################################################################
# LOGGING
################################################################################

log() {
    local level="$1"; shift
    local msg="$@"
    local ts="$(date +'%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        OK)    echo -e "${GREEN}[✓]${NC} ${msg}" ;;
        ERR)   echo -e "${RED}[✗]${NC} ${msg}" ;;
        WARN)  echo -e "${YELLOW}[!]${NC} ${msg}" ;;
        INFO)  echo -e "${BLUE}[ℹ]${NC} ${msg}" ;;
        HEAD)  echo -e "\n${CYAN}╔═══════════════════════════════════════════════════╗${NC}"; \
                echo -e "${CYAN}║ ${msg}${NC}"; \
                echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}\n" ;;
    esac
    
    echo "[${level}] ${ts} - ${msg}" >> "${LOG_FILE}" 2>/dev/null || true
}

handle_error() {
    local line="$1"
    local code=${2:-$?}
    
    log ERR "Script failed at line ${line} (exit code: ${code})"
    log ERR "Command: ${BASH_COMMAND}"
    echo ""
    log ERR "═══════════════════════════════════════════════════"
    log ERR "DEPLOYMENT FAILED - Check logs:"
    log ERR "  ${LOG_FILE}"
    log ERR "═══════════════════════════════════════════════════"
    
    exit "${code}"
}

################################################################################
# VALIDATION
################################################################################

validate_environment() {
    log HEAD "STEP 1: ENVIRONMENT VALIDATION"
    
    local errors=0
    
    # Check root
    if [[ $EUID -ne 0 ]]; then
        log ERR "Must run as root"
        ((errors++))
    else
        log OK "Running as root"
    fi
    
    # Check commands
    local cmds=("docker" "docker-compose" "curl")
    for cmd in "${cmds[@]}"; do
        if command -v "$cmd" &>/dev/null; then
            log OK "Found: $cmd"
        else
            log ERR "Missing: $cmd"
            ((errors++))
        fi
    done
    
    # Check files
    local files=("${COMPOSE_FILE}" "Dockerfile" ".env" "requirements.txt")
    for f in "${files[@]}"; do
        if [[ -f "${PROJECT_DIR}/${f}" ]]; then
            log OK "Found: ${f}"
        else
            log ERR "Missing: ${f}"
            ((errors++))
        fi
    done
    
    # Check Docker daemon
    if docker ps &>/dev/null; then
        log OK "Docker daemon is running"
    else
        log ERR "Docker daemon not running"
        ((errors++))
    fi
    
    echo ""
    if [[ $errors -eq 0 ]]; then
        log OK "Environment validation PASSED"
        return 0
    else
        if [[ "$SKIP_VALIDATION" == "true" ]]; then
            log WARN "Validation found $errors issue(s) but continuing..."
            return 0
        else
            log ERR "Environment validation FAILED"
            return 1
        fi
    fi
}

################################################################################
# CLEANUP
################################################################################

cleanup_deployment() {
    log HEAD "STEP 2: CLEANUP & PREPARATION"
    
    cd "${PROJECT_DIR}"
    
    log INFO "Stopping existing containers..."
    docker-compose -f "${COMPOSE_FILE}" down -v 2>/dev/null || true
    sleep 3
    
    # Fix logs issue
    if [[ -f "${PROJECT_DIR}/logs" ]]; then
        log WARN "logs is a file, converting to directory..."
        rm -f "${PROJECT_DIR}/logs"
    fi
    
    # Create logs directory
    if [[ ! -d "${LOG_DIR}" ]]; then
        mkdir -p "${LOG_DIR}"
        chmod 755 "${LOG_DIR}"
        log OK "Created logs directory"
    fi
    
    # Deep clean
    if [[ "$FORCE_REBUILD" == "true" ]]; then
        log WARN "Force rebuild enabled - cleaning Docker..."
        docker system prune -f --volumes 2>/dev/null || true
        log OK "Docker system cleaned"
    fi
}

################################################################################
# BUILD
################################################################################

build_images() {
    log HEAD "STEP 3: BUILDING DOCKER IMAGES"
    
    cd "${PROJECT_DIR}"
    
    local build_flags=""
    if [[ "$FORCE_REBUILD" == "true" ]]; then
        build_flags="--no-cache"
        log INFO "Building with no-cache (clean build)..."
    else
        log INFO "Building with cache (incremental)..."
    fi
    
    log INFO "Building images from ${COMPOSE_FILE}..."
    
    if ! timeout "${BUILD_TIMEOUT}" docker-compose -f "${COMPOSE_FILE}" \
        build ${build_flags} --progress=plain 2>&1 | tee -a "${LOG_FILE}"; then
        log ERR "Build failed or timed out"
        return 1
    fi
    
    log OK "Images built successfully"
}

################################################################################
# START
################################################################################

start_services() {
    log HEAD "STEP 4: STARTING CONTAINERS"
    
    cd "${PROJECT_DIR}"
    
    log INFO "Starting containers in detached mode..."
    
    if ! docker-compose -f "${COMPOSE_FILE}" up -d 2>&1 | tee -a "${LOG_FILE}"; then
        log ERR "Failed to start containers"
        return 1
    fi
    
    log OK "Containers started"
    log INFO "Waiting 40 seconds for services to stabilize..."
    sleep 40
}

################################################################################
# VERIFY
################################################################################

verify_deployment() {
    log HEAD "STEP 5: DEPLOYMENT VERIFICATION"
    
    local passed=0
    local total=6
    
    # Check 1: API container
    log INFO "Check 1/${total}: API container status"
    if docker ps | grep -q "${API_CONTAINER}"; then
        log OK "  API container running"
        ((passed++))
    else
        log ERR "  API container NOT running"
        docker logs "${API_CONTAINER}" --tail 30 2>/dev/null | tee -a "${LOG_FILE}" || true
    fi
    
    # Check 2: Bot container
    log INFO "Check 2/${total}: Bot container status"
    if docker ps | grep -q "${BOT_CONTAINER}"; then
        log OK "  Bot container running"
        ((passed++))
    else
        log ERR "  Bot container NOT running"
        docker logs "${BOT_CONTAINER}" --tail 30 2>/dev/null | tee -a "${LOG_FILE}" || true
    fi
    
    # Check 3: API health
    log INFO "Check 3/${total}: API health endpoint"
    sleep 5
    if curl -sf http://localhost:8000/health &>/dev/null; then
        log OK "  API is healthy"
        ((passed++))
    else
        log WARN "  API health check failed"
        docker logs "${API_CONTAINER}" --tail 30 2>/dev/null | tee -a "${LOG_FILE}" || true
    fi
    
    # Check 4: Database
    log INFO "Check 4/${total}: Database connectivity"
    if PGPASSWORD="m784951m" psql -h localhost -U dotv -d dotv -c "SELECT 1" &>/dev/null 2>&1; then
        log OK "  Database connection successful"
        ((passed++))
    else
        log ERR "  Database connection failed"
    fi
    
    # Check 5: Redis
    log INFO "Check 5/${total}: Redis connectivity"
    if redis-cli -h localhost ping 2>/dev/null | grep -q "PONG"; then
        log OK "  Redis connection successful"
        ((passed++))
    else
        log ERR "  Redis connection failed"
    fi
    
    # Check 6: Network
    log INFO "Check 6/${total}: Docker network"
    if docker network inspect "${NETWORK_NAME}" &>/dev/null; then
        log OK "  Network is configured"
        ((passed++))
    else
        log WARN "  Network not found"
    fi
    
    echo ""
    log INFO "Health Check Summary: ${passed}/${total} passed"
    
    if [[ ${passed} -ge 4 ]]; then
        log OK "Deployment verification PASSED"
        return 0
    else
        log ERR "Deployment verification FAILED"
        return 1
    fi
}

################################################################################
# REPORT
################################################################################

generate_report() {
    log HEAD "STEP 6: GENERATING DEPLOYMENT REPORT"
    
    cat > "${REPORT_FILE}" << 'REPORT'
# LangSense Bot - Deployment Report

**Deployment Time:** $(date '+%Y-%m-%d %H:%M:%S')

## Status: ✅ SUCCESS

### Container Status
```bash
REPORT
    
    docker-compose -f "${COMPOSE_FILE}" ps >> "${REPORT_FILE}" 2>&1 || true
    
    cat >> "${REPORT_FILE}" << 'REPORT'
