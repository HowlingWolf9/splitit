import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const keystorePath = path.join(rootDir, 'android', 'app', 'release.keystore');

// Find keytool
let keytool = 'keytool';
if (process.env.JAVA_HOME) {
  const kt = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool');
  if (fs.existsSync(kt)) {
    keytool = `"${kt}"`;
  }
} else {
  const commonJava = [
    'C:\\Program Files\\Java\\jdk-21\\bin\\keytool.exe',
    'C:\\Program Files\\Java\\jdk-17\\bin\\keytool.exe'
  ];
  for (const c of commonJava) {
    if (fs.existsSync(c)) {
      keytool = `"${c}"`;
      break;
    }
  }
}

const alias = process.argv[2] || 'splitit-key';
const password = process.argv[3] || 'splititpass123';

console.log('🔑 Generating release keystore for SplitIt...');
console.log(`Target: ${keystorePath}`);
console.log(`Alias: ${alias}\n`);

try {
  if (fs.existsSync(keystorePath)) {
    const backupPath = `${keystorePath}.${Date.now()}.bak`;
    console.log(`⚠️  Existing keystore found. Backed up to ${path.basename(backupPath)}...`);
    fs.copyFileSync(keystorePath, backupPath);
    fs.unlinkSync(keystorePath);
  }

  const cmd = `${keytool} -genkeypair -v -keystore "${keystorePath}" -alias "${alias}" -keyalg RSA -keysize 2048 -validity 10000 -storepass "${password}" -keypass "${password}" -dname "CN=SplitIt, OU=Mobile, O=SplitIt, L=City, ST=State, C=US"`;
  execSync(cmd, { stdio: 'inherit' });

  console.log('\n✅ Keystore generated successfully!');
  const base64Keystore = fs.readFileSync(keystorePath).toString('base64');

  // Auto-configure android/keystore.properties for seamless local release builds
  const keystorePropsPath = path.join(rootDir, 'android', 'keystore.properties');
  const propsContent = `storeFile=release.keystore\nstorePassword=${password}\nkeyAlias=${alias}\nkeyPassword=${password}\n`;
  fs.writeFileSync(keystorePropsPath, propsContent);
  console.log(`📝 Local signing configuration saved to: ${keystorePropsPath}`);

  console.log('\n📋 GitHub Actions Secrets Configuration:');
  console.log('Add these secrets to GitHub under Settings -> Secrets and variables -> Actions:\n');
  console.log(`- KEYSTORE_PASSWORD: ${password}`);
  console.log(`- KEY_ALIAS: ${alias}`);
  console.log(`- KEY_PASSWORD: ${password}`);
  console.log(`- ANDROID_KEYSTORE_BASE64: (Base64 string copied to keystore-base64.txt)\n`);

  const outputTxt = path.join(rootDir, 'keystore-base64.txt');
  fs.writeFileSync(outputTxt, base64Keystore);
  console.log(`💾 Saved base64 string to: ${outputTxt}`);
  console.log('⚠️  NOTE: keystore-base64.txt, release.keystore, and keystore.properties are ignored by git to protect secrets.\n');
} catch (err) {
  console.error('❌ Error generating keystore:', err.message);
  process.exit(1);
}
