import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

// Locate Java if JAVA_HOME is not set
if (!process.env.JAVA_HOME) {
  const commonJavaPaths = [
    'C:\\Program Files\\Java\\jdk-21',
    'C:\\Program Files\\Java\\jdk-17',
    'C:\\Program Files\\Java\\jdk-24',
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Java', 'jdk-21')
  ].filter(Boolean);

  for (const p of commonJavaPaths) {
    if (fs.existsSync(p)) {
      process.env.JAVA_HOME = p;
      process.env.PATH = `${path.join(p, 'bin')}${path.delimiter}${process.env.PATH}`;
      break;
    }
  }
}

// Locate Android SDK if ANDROID_HOME is not set
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const commonSdkPaths = [
    'E:\\Android\\Sdk',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    process.env.HOME ? path.join(process.env.HOME, 'Library', 'Android', 'sdk') : null,
    process.env.HOME ? path.join(process.env.HOME, 'Android', 'Sdk') : null
  ].filter(Boolean);

  for (const p of commonSdkPaths) {
    if (fs.existsSync(p)) {
      process.env.ANDROID_HOME = p;
      break;
    }
  }
}

const target = process.argv[2] || 'all';

console.log('🚀 Step 1/3: Building Vite web application...');
const viteBuild = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
  env: process.env
});
if (viteBuild.status !== 0) {
  console.error('❌ Vite build failed.', viteBuild.error || '');
  process.exit(viteBuild.status || 1);
}

console.log('\n📲 Step 2/3: Syncing Capacitor Android assets...');
const capSync = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
  env: process.env
});
if (capSync.status !== 0) {
  console.error('❌ Capacitor sync failed.', capSync.error || '');
  process.exit(capSync.status || 1);
}

console.log('\n📦 Step 3/3: Running Gradle release build...');
const gradleTasks = [];
if (target === 'apk') {
  gradleTasks.push('assembleRelease');
} else if (target === 'bundle') {
  gradleTasks.push('bundleRelease');
} else {
  gradleTasks.push('assembleRelease', 'bundleRelease');
}

// Safely clean release output folder to avoid OneDrive file-locking conflicts
const apkOutputDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
if (fs.existsSync(apkOutputDir)) {
  try {
    fs.rmSync(apkOutputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
  } catch {
    // Continue even if Windows briefly delays file handle release
  }
}

const gradlewCmd = process.platform === 'win32'
  ? path.join(androidDir, 'gradlew.bat')
  : './gradlew';

const gradleBuild = spawnSync(gradlewCmd, gradleTasks, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env: process.env
});
if (gradleBuild.status !== 0) {
  console.error('❌ Gradle build failed.', gradleBuild.error || '');
  process.exit(gradleBuild.status || 1);
}

console.log('\n🎉 Release build completed successfully!\n');

const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
const bundleDir = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release');

if (fs.existsSync(apkDir)) {
  const apks = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
  for (const apk of apks) {
    const fullPath = path.join(apkDir, apk);
    const sizeMb = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2);
    console.log(`📱 APK Artifact: ${fullPath} (${sizeMb} MB)`);
  }
}

if (fs.existsSync(bundleDir)) {
  const aabs = fs.readdirSync(bundleDir).filter(f => f.endsWith('.aab'));
  for (const aab of aabs) {
    const fullPath = path.join(bundleDir, aab);
    const sizeMb = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2);
    console.log(`📦 AAB Bundle Artifact: ${fullPath} (${sizeMb} MB)`);
  }
}
