#!/bin/bash
# PWM Database Migration Script

# Load environment
export PYTHONPATH=/workspaces/botv:$PYTHONPATH

# Set default values
DB_ENV=${1:-development}
MIGRATION_ACTION=${2:-upgrade}

echo "=== PWM Database Migration ==="
echo "Environment: $DB_ENV"
echo "Action: $MIGRATION_ACTION"

# Run migration
cd /workspaces/botv/pwm

case $MIGRATION_ACTION in
    upgrade)
        echo "Upgrading database..."
        alembic -c pwm/database/alembic.ini upgrade head
        ;;
    downgrade)
        echo "Downgrading database..."
        alembic -c pwm/database/alembic.ini downgrade -1
        ;;
    create)
        MESSAGE=${3:-"Migration"}
        echo "Creating new migration: $MESSAGE"
        alembic -c pwm/database/alembic.ini revision --autogenerate -m "$MESSAGE"
        ;;
    *)
        echo "Unknown action: $MIGRATION_ACTION"
        exit 1
        ;;
esac

echo "=== Migration Complete ==="
