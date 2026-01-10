#!/bin/bash

# Make all scripts executable
chmod +x scripts/setup_infra.sh
chmod +x scripts/backup_db.sh
chmod +x scripts/restore_db.sh
chmod +x scripts/health_check.sh
chmod +x scripts/reinit_infra.sh

echo "✅ All scripts are now executable"
echo ""
echo "Available commands:"
echo "  ./scripts/setup_infra.sh    - Initial infrastructure setup"
echo "  ./scripts/health_check.sh   - Check infrastructure health"
echo "  ./scripts/backup_db.sh      - Backup PostgreSQL database"
echo "  ./scripts/restore_db.sh     - Restore from backup"
echo "  ./scripts/reinit_infra.sh   - Reinitialize entire infrastructure"
echo ""
echo "Docker Compose commands:"
echo "  docker-compose up -d        - Start all services"
echo "  docker-compose down         - Stop all services"
echo "  docker-compose logs -f      - Follow logs"
echo "  docker-compose ps           - Show container status"
echo ""
