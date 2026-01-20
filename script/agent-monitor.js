#!/usr/bin/env node

/**
 * VEX Platform Agent Monitor
 * وكيل مراقبة آمن لمشروع VEX على Replit
 * 
 * الوضع: قراءة فقط (Read-Only Monitoring)
 * لا يطبق أي تغييرات بدون موافقة يدوية
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// تحميل الإعدادات
let config = {};
let snapshots = {};

async function loadConfig() {
  try {
    const configPath = path.join(ROOT_DIR, '.agent-replit-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configData);
    console.log('✅ تم تحميل الإعدادات بنجاح');
  } catch (error) {
    console.error('❌ فشل تحميل الإعدادات:', error.message);
    process.exit(1);
  }
}

async function loadSnapshots() {
  try {
    const snapshotPath = path.join(ROOT_DIR, config.snapshot.path);
    const snapshotData = await fs.readFile(snapshotPath, 'utf-8');
    snapshots = JSON.parse(snapshotData);
  } catch (error) {
    snapshots = { version: '1.0.0', snapshots: [], lastSnapshot: null };
  }
}

async function saveSnapshot(snapshot) {
  try {
    const snapshotPath = path.join(ROOT_DIR, config.snapshot.path);
    snapshots.snapshots.push(snapshot);
    snapshots.lastSnapshot = new Date().toISOString();
    
    // الاحتفاظ فقط بالسناپشوتات الأخيرة
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.snapshot.retentionDays);
    snapshots.snapshots = snapshots.snapshots.filter(s => 
      new Date(s.timestamp) > cutoffDate
    );
    
    await fs.writeFile(snapshotPath, JSON.stringify(snapshots, null, 2));
  } catch (error) {
    console.error('⚠️ فشل حفظ السناپشوت:', error.message);
  }
}

async function log(level, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };
  
  const logMessage = `[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}${data ? ' - ' + JSON.stringify(data) : ''}\n`;
  
  console.log(logMessage.trim());
  
  if (config.logging?.enabled) {
    try {
      const logDir = path.join(ROOT_DIR, path.dirname(config.logging.path));
      await fs.mkdir(logDir, { recursive: true });
      const logPath = path.join(ROOT_DIR, config.logging.path);
      await fs.appendFile(logPath, logMessage);
    } catch (error) {
      console.error('⚠️ فشل الكتابة في سجل الأحداث:', error.message);
    }
  }
}

async function checkHealth() {
  await log('info', '🏥 فحص حالة النظام...');
  
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };
  
  try {
    // فحص package.json
    const packagePath = path.join(ROOT_DIR, 'package.json');
    const packageData = await fs.readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(packageData);
    health.checks.packageJson = { status: 'ok', version: pkg.version };
  } catch (error) {
    health.checks.packageJson = { status: 'error', error: error.message };
    health.status = 'unhealthy';
  }
  
  try {
    // فحص tsconfig.json
    const tsconfigPath = path.join(ROOT_DIR, 'tsconfig.json');
    await fs.access(tsconfigPath);
    health.checks.tsconfig = { status: 'ok' };
  } catch (error) {
    health.checks.tsconfig = { status: 'error', error: error.message };
    health.status = 'unhealthy';
  }
  
  try {
    // فحص ملفات الإعدادات الرئيسية
    const configFiles = [
      'vite.config.ts',
      'drizzle.config.ts',
      'tailwind.config.ts'
    ];
    
    for (const file of configFiles) {
      try {
        await fs.access(path.join(ROOT_DIR, file));
        health.checks[file] = { status: 'ok' };
      } catch {
        health.checks[file] = { status: 'missing' };
      }
    }
  } catch (error) {
    health.checks.configFiles = { status: 'error', error: error.message };
  }
  
  await log('info', `🏥 حالة النظام: ${health.status}`, health.checks);
  return health;
}

async function checkTypeScript() {
  if (!config.monitoring?.checkTypeScript) {
    return { skipped: true };
  }
  
  await log('info', '🔍 فحص أخطاء TypeScript...');
  
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit --pretty false', {
      cwd: ROOT_DIR,
      timeout: 60000
    });
    
    if (!stderr && !stdout) {
      await log('info', '✅ لا توجد أخطاء TypeScript');
      return { status: 'ok', errors: 0 };
    }
    
    const errors = (stdout + stderr).split('\n').filter(line => 
      line.includes('error TS')
    );
    
    if (errors.length > 0) {
      await log('warning', `⚠️ تم العثور على ${errors.length} خطأ TypeScript`, {
        count: errors.length,
        sample: errors.slice(0, 5)
      });
    }
    
    return { status: 'errors', count: errors.length, errors: errors.slice(0, 10) };
  } catch (error) {
    if (error.stdout || error.stderr) {
      const output = error.stdout + error.stderr;
      const errors = output.split('\n').filter(line => line.includes('error TS'));
      
      if (errors.length > 0) {
        await log('warning', `⚠️ أخطاء TypeScript: ${errors.length}`, {
          count: errors.length
        });
        return { status: 'errors', count: errors.length, errors: errors.slice(0, 10) };
      }
    }
    
    await log('error', '❌ فشل فحص TypeScript', { error: error.message });
    return { status: 'failed', error: error.message };
  }
}

async function checkSecurity() {
  if (!config.monitoring?.checkSecurity) {
    return { skipped: true };
  }
  
  await log('info', '🔒 فحص التحديثات الأمنية...');
  
  try {
    const { stdout } = await execAsync('npm audit --json', {
      cwd: ROOT_DIR,
      timeout: 30000
    });
    
    const audit = JSON.parse(stdout);
    const vulnerabilities = audit.metadata?.vulnerabilities || {};
    
    const total = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
      await log('info', '✅ لا توجد ثغرات أمنية معروفة');
      return { status: 'ok', vulnerabilities: {} };
    }
    
    const critical = vulnerabilities.critical || 0;
    const high = vulnerabilities.high || 0;
    
    if (critical > 0 || high > 0) {
      await log('critical', `🚨 ثغرات أمنية حرجة: ${critical} حرجة، ${high} عالية`, vulnerabilities);
    } else {
      await log('warning', `⚠️ ثغرات أمنية: ${total} إجمالي`, vulnerabilities);
    }
    
    return { status: 'vulnerabilities', total, vulnerabilities };
  } catch (error) {
    await log('error', '❌ فشل فحص الأمان', { error: error.message });
    return { status: 'failed', error: error.message };
  }
}

async function generateReport(health, typescript, security) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      health: health.status || 'unknown',
      typescript: typescript.status || 'skipped',
      security: security.status || 'skipped'
    },
    details: {
      health,
      typescript,
      security
    },
    recommendations: []
  };
  
  // توصيات بناءً على النتائج
  if (health.status === 'unhealthy') {
    report.recommendations.push({
      priority: 'high',
      message: 'توجد مشاكل في ملفات الإعدادات الأساسية، يرجى المراجعة'
    });
  }
  
  if (typescript.count > 0) {
    report.recommendations.push({
      priority: 'medium',
      message: `يوجد ${typescript.count} خطأ TypeScript، يُنصح بإصلاحها`
    });
  }
  
  if (security.vulnerabilities?.critical > 0) {
    report.recommendations.push({
      priority: 'critical',
      message: `⚠️ يوجد ${security.vulnerabilities.critical} ثغرة أمنية حرجة - يجب الإصلاح فوراً!`
    });
  }
  
  if (security.vulnerabilities?.high > 0) {
    report.recommendations.push({
      priority: 'high',
      message: `يوجد ${security.vulnerabilities.high} ثغرة أمنية عالية الخطورة`
    });
  }
  
  return report;
}

async function cleanupTempFiles() {
  await log('info', '🧹 تنظيف الملفات المؤقتة...');
  
  const tempPatterns = [
    '**/*.tmp',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.log.old'
  ];
  
  let cleaned = 0;
  
  try {
    // تنظيف آمن فقط للملفات المؤقتة المعروفة
    for (const pattern of tempPatterns) {
      try {
        const { stdout } = await execAsync(`find . -name "${pattern}" -type f`, {
          cwd: ROOT_DIR,
          timeout: 10000
        });
        
        const files = stdout.trim().split('\n').filter(f => f);
        cleaned += files.length;
        
        if (files.length > 0) {
          await log('info', `🗑️ تم العثور على ${files.length} ملف مؤقت من نوع ${pattern}`);
        }
      } catch (error) {
        // تجاهل الأخطاء في البحث
      }
    }
    
    await log('info', `✅ تم فحص ${cleaned} ملف مؤقت (بدون حذف - يتطلب موافقة)`);
    return { found: cleaned, deleted: 0 };
  } catch (error) {
    await log('error', '❌ فشل التنظيف', { error: error.message });
    return { found: 0, deleted: 0, error: error.message };
  }
}

async function createSnapshot(health, typescript, security) {
  const snapshot = {
    timestamp: new Date().toISOString(),
    health: health.status,
    typescript: {
      status: typescript.status,
      errorCount: typescript.count || 0
    },
    security: {
      status: security.status,
      vulnerabilities: security.vulnerabilities || {}
    }
  };
  
  await saveSnapshot(snapshot);
  await log('info', '📸 تم حفظ سناپشوت الحالة');
}

async function main() {
  console.log('🤖 بدء وكيل مراقبة VEX Platform');
  console.log('================================================');
  
  await loadConfig();
  await loadSnapshots();
  
  if (config.mode !== 'read-only-monitoring') {
    await log('error', '❌ الوضع غير آمن! يجب أن يكون الوضع read-only-monitoring');
    process.exit(1);
  }
  
  await log('info', '🚀 بدء عملية المراقبة');
  
  // الفحوصات
  const health = await checkHealth();
  const typescript = await checkTypeScript();
  const security = await checkSecurity();
  
  // تنظيف (فحص فقط)
  const cleanup = await cleanupTempFiles();
  
  // التقرير
  const report = await generateReport(health, typescript, security);
  
  console.log('\n📊 ملخص التقرير');
  console.log('================================================');
  console.log(`حالة النظام: ${report.summary.health}`);
  console.log(`TypeScript: ${report.summary.typescript}`);
  console.log(`الأمان: ${report.summary.security}`);
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 التوصيات:');
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
    });
  } else {
    console.log('\n✅ كل شيء على ما يرام!');
  }
  
  // حفظ السناپشوت
  if (config.snapshot?.enabled) {
    await createSnapshot(health, typescript, security);
  }
  
  // حفظ التقرير
  try {
    const reportDir = path.join(ROOT_DIR, 'logs');
    await fs.mkdir(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `agent-report-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 تم حفظ التقرير: ${reportPath}`);
  } catch (error) {
    console.error('⚠️ فشل حفظ التقرير:', error.message);
  }
  
  await log('info', '✅ اكتملت عملية المراقبة');
  console.log('\n================================================');
  console.log('🤖 انتهى وكيل المراقبة');
}

// التشغيل
main().catch(error => {
  console.error('❌ خطأ فادح:', error);
  process.exit(1);
});
