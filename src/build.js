const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname);
const backupDir = path.join(__dirname, 'backup_js');

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'backup_js' && file !== 'node_modules') {
        getAllJsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') && file !== 'build.js') {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function backupJsFiles() {
  console.log('开始备份JS文件...');
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
  fs.mkdirSync(backupDir, { recursive: true });
  const jsFiles = getAllJsFiles(srcDir);
  jsFiles.forEach(file => {
    const relativePath = path.relative(srcDir, file);
    const backupPath = path.join(backupDir, relativePath);
    const backupDirPath = path.dirname(backupPath);
    if (!fs.existsSync(backupDirPath)) {
      fs.mkdirSync(backupDirPath, { recursive: true });
    }
    fs.copyFileSync(file, backupPath);
  });
  console.log('备份完成');
}

function obfuscateJsFiles() {
  console.log('开始混淆JS文件...');
  const jsFiles = getAllJsFiles(srcDir);
  jsFiles.forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      debugProtectionInterval: 0,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      renameGlobals: false,
      rotateStringArray: true,
      selfDefending: false,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false
    }).getObfuscatedCode();
    fs.writeFileSync(file, obfuscatedCode, 'utf8');
  });
  console.log('混淆完成');
}

function restoreJsFiles() {
  console.log('开始恢复JS文件...');
  const jsFiles = getAllJsFiles(backupDir);
  jsFiles.forEach(file => {
    const relativePath = path.relative(backupDir, file);
    const originalPath = path.join(srcDir, relativePath);
    fs.copyFileSync(file, originalPath);
  });
  console.log('恢复完成');
}

function deleteBackup() {
  console.log('删除备份目录...');
  if (fs.existsSync(backupDir)) {
    if (process.platform === 'win32') {
      execSync(`rmdir /s /q "${backupDir}"`, { stdio: 'inherit' });
    } else {
      execSync(`rm -rf "${backupDir}"`, { stdio: 'inherit' });
    }
  }
  console.log('备份目录已删除');
}

function build() {
  try {
    backupJsFiles();
    obfuscateJsFiles();
    console.log('开始打包...');
    execSync('npx electron-builder --win --x64', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('打包完成');
  } catch (error) {
    console.error('打包过程出错:', error);
  } finally {
    restoreJsFiles();
    deleteBackup();
  }
}

build();

