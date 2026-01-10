#!/bin/bash

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                            ║"
echo "║                   🤖 TASKFLOWAI BOT STATUS REPORT                          ║"
echo "║                                                                            ║"
echo "║                        $(date '+%Y-%m-%d %H:%M:%S')                        ║"
echo "║                                                                            ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if bot is running
BOT_PID=$(ps aux | grep "python main.py" | grep -v grep | awk '{print $2}')

if [ -n "$BOT_PID" ]; then
    echo "✅ BOT STATUS: RUNNING"
    echo "   Process ID: $BOT_PID"
    
    # Get process info
    CPU=$(ps aux | grep "python main.py" | grep -v grep | awk '{print $3}')
    MEM=$(ps aux | grep "python main.py" | grep -v grep | awk '{print $4}')
    echo "   CPU Usage: ${CPU}%"
    echo "   Memory: ${MEM}%"
    
    # Get uptime
    START_TIME=$(ps -o lstart= -p $BOT_PID)
    echo "   Started: $START_TIME"
else
    echo "❌ BOT STATUS: NOT RUNNING"
    echo ""
    echo "To start the bot, run:"
    echo "  cd /workspaces/TaskFlowAI- && source venv/bin/activate && python main.py > bot_output.log 2>&1 &"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 BOT INFORMATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Username:    @Gkdkkdkfbot"
echo "   Name:        Testerr"
echo "   Bot ID:      8549135277"
echo "   Framework:   aiogram v3"
echo "   Entry Point: main.py"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 FEATURES ACTIVE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✅ Legacy Deposit/Withdrawal System"
echo "   ✅ User Registration & Profiles"
echo "   ✅ Multi-Currency Support (18 currencies)"
echo "   ✅ Transaction Tracking"
echo "   ✅ Flying Plane Game"
echo "   ✅ Admin Balance Protection (User 7146701713 = 10B SAR)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💬 AVAILABLE COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   LEGACY FEATURES:"
echo "   /register              - Start user registration"
echo "   💰 طلب إيداع           - Request deposit"
echo "   💸 طلب سحب             - Request withdrawal"
echo "   📋 طلباتي              - View transactions"
echo "   👤 حسابي               - View profile & balance"
echo "   💱 تغيير العملة        - Change currency"
echo "   🆘 دعم                 - Support information"
echo ""
echo "   NEW FEATURES:"
echo "   /play_flying_plane <amount> - Play game"
echo "   /flying_plane_help          - Game help"
echo "   /flying_plane_stats         - Game statistics"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📂 CSV FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CSV_FILES=(
    "users.csv"
    "transactions.csv"
    "companies.csv"
    "exchange_addresses.csv"
    "complaints.csv"
    "system_settings.csv"
)

for csv_file in "${CSV_FILES[@]}"; do
    if [ -f "$csv_file" ]; then
        size=$(stat -f%z "$csv_file" 2>/dev/null || stat -c%s "$csv_file" 2>/dev/null)
        lines=$(wc -l < "$csv_file")
        echo "   ✅ $csv_file: $size bytes, $lines lines"
    else
        echo "   ❌ $csv_file: NOT FOUND"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STATISTICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count users (excluding header)
USER_COUNT=$(($(wc -l < users.csv) - 1))
echo "   Users Registered: $USER_COUNT"

# Count transactions (excluding header)
TRANS_COUNT=$(($(wc -l < transactions.csv) - 1))
echo "   Total Transactions: $TRANS_COUNT"

# Count companies (excluding header)
COMPANY_COUNT=$(($(wc -l < companies.csv) - 1))
echo "   Payment Companies: $COMPANY_COUNT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📜 RECENT BOT LOGS (Last 10 lines)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -10 bot_output.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 QUICK COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   View live logs:  tail -f bot_output.log"
echo "   Stop bot:        pkill -f 'python main.py'"
echo "   Restart bot:     ./bot_status.sh && python main.py > bot_output.log 2>&1 &"
echo "   Check status:    ./bot_status.sh"
echo ""
echo "✅ Bot is operational and ready for testing!"
echo ""
