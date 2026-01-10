#!/usr/bin/env python3
"""
Bot Entry Point Verification Script
Confirms main.py is the active entry point
"""

import subprocess
import sys
import os

def check_bot_status():
    """Check if bot is running and which file is the entry point"""
    
    print("\n" + "="*70)
    print("  🤖 TASKFLOWAI BOT STATUS CHECK")
    print("="*70 + "\n")
    
    # Check if main.py process is running
    try:
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True
        )
        
        main_py_running = False
        comprehensive_py_running = False
        
        for line in result.stdout.split('\n'):
            if 'python main.py' in line and 'grep' not in line:
                main_py_running = True
                pid = line.split()[1]
                print(f"✅ main.py is RUNNING")
                print(f"   Process ID: {pid}")
                print(f"   Entry Point: main.py")
                print(f"   Framework: aiogram v3")
                print(f"   Status: ACTIVE (PRIMARY)")
                
            if 'python comprehensive_bot.py' in line and 'grep' not in line:
                comprehensive_py_running = True
                pid = line.split()[1]
                print(f"⚠️  comprehensive_bot.py is RUNNING")
                print(f"   Process ID: {pid}")
                print(f"   Entry Point: comprehensive_bot.py")
                print(f"   Status: LEGACY (SHOULD NOT BE USED)")
        
        print()
        
        if main_py_running and not comprehensive_py_running:
            print("✅ CORRECT SETUP: main.py is the active entry point")
            print("   All Phase 1 & Phase 2 services should integrate here")
            return True
            
        elif not main_py_running and comprehensive_py_running:
            print("⚠️  WARNING: comprehensive_bot.py is running instead of main.py")
            print("   This is the LEGACY implementation")
            print("   Recommendation: Stop comprehensive_bot.py and start main.py")
            return False
            
        elif main_py_running and comprehensive_py_running:
            print("❌ ERROR: Both main.py and comprehensive_bot.py are running")
            print("   This causes conflicts - only ONE should run")
            print("   Recommendation: Stop comprehensive_bot.py")
            return False
            
        else:
            print("❌ ERROR: Bot is NOT running")
            print("   Start bot with: cd /workspaces/TaskFlowAI- && source venv/bin/activate && python main.py")
            return False
            
    except Exception as e:
        print(f"❌ Error checking bot status: {e}")
        return False

def check_files_exist():
    """Verify required files exist"""
    
    print("\n" + "-"*70)
    print("  📁 FILE STRUCTURE VERIFICATION")
    print("-"*70 + "\n")
    
    required_files = {
        'main.py': 'Primary entry point',
        'bot.py': 'Bot initialization',
        'config.py': 'Configuration',
        'models.py': 'Data models',
        'handlers/flying_plane_handler.py': 'Flying Plane game handler',
        'services/domain_services/games_service.py': 'Games service',
        'services/domain_services/csv_manager.py': 'CSV manager',
        'ARCHITECTURE.md': 'Architecture documentation'
    }
    
    all_exist = True
    
    for file_path, description in required_files.items():
        exists = os.path.exists(file_path)
        status = "✅" if exists else "❌"
        print(f"{status} {file_path:45s} - {description}")
        if not exists:
            all_exist = False
    
    print()
    
    if all_exist:
        print("✅ All required files exist")
    else:
        print("❌ Some required files are missing")
    
    return all_exist

def main():
    """Main verification function"""
    
    bot_running = check_bot_status()
    files_ok = check_files_exist()
    
    print("\n" + "="*70)
    print("  📊 SUMMARY")
    print("="*70 + "\n")
    
    if bot_running and files_ok:
        print("✅ SYSTEM STATUS: OPERATIONAL")
        print("   - Bot is running with correct entry point (main.py)")
        print("   - All required files are present")
        print("   - Flying Plane game integrated")
        print("   - Ready for Phase 2 development")
        print("\n📱 Bot: @Gkdkkdkfbot")
        print("⏸️  Status: Waiting for manual testing confirmation")
        return 0
    else:
        print("⚠️  SYSTEM STATUS: NEEDS ATTENTION")
        if not bot_running:
            print("   - Bot is not running correctly")
        if not files_ok:
            print("   - Some required files are missing")
        return 1

if __name__ == "__main__":
    sys.exit(main())
