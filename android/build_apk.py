#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
作业票助手 · 安卓 APK 构建脚本（不依赖 Gradle）

流程：
  1. 把网页产物复制进 assets/www
  2. aapt2 编译并链接资源，生成基础 APK
  3. javac 编译 Java -> d8 转 dex -> 塞进 APK
  4. zipalign 对齐 -> apksigner 用本地密钥签名

用法：python build_apk.py
产物：android/build/permit-guard-1.0.apk
"""

import glob
import io
import os
import re
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
BUILD = os.path.join(HERE, 'build')

SDK = 'C:/Android/Sdk'
BT = os.path.join(SDK, 'build-tools', '36.0.0')
AJAR = os.path.join(SDK, 'platforms', 'android-34', 'android.jar')
AAPT2 = os.path.join(BT, 'aapt2.exe')
ZIPALIGN = os.path.join(BT, 'zipalign.exe')
D8_JAR = os.path.join(BT, 'lib', 'd8.jar')
SIGNER_JAR = os.path.join(BT, 'lib', 'apksigner.jar')

KEYSTORE = os.path.join(HERE, 'permit-guard.jks')
KS_PASS = 'permitguard'
KS_ALIAS = 'permitguard'

VERSION_CODE = '33'
VERSION_NAME = '4.2'
MIN_SDK = '24'
TARGET_SDK = '34'
OUT_APK = os.path.join(BUILD, 'permit-guard-%s.apk' % VERSION_NAME)


def log(msg):
    print('  ' + msg, flush=True)


def run(cmd, cwd=None):
    printable = ' '.join('"%s"' % c if ' ' in c else c for c in cmd)
    if len(printable) > 180:
        printable = printable[:180] + ' ...'
    print('>>> ' + printable, flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def check_env():
    missing = [p for p in (AAPT2, ZIPALIGN, D8_JAR, SIGNER_JAR, AJAR) if not os.path.exists(p)]
    if missing:
        print('缺少构建工具：')
        for m in missing:
            print('  ' + m)
        sys.exit(1)
    for tool in ('java', 'javac', 'keytool'):
        if shutil.which(tool) is None:
            print('缺少 JDK 命令：' + tool)
            sys.exit(1)


def stage_web_assets():
    www = os.path.join(BUILD, 'assets', 'www')
    if os.path.exists(www):
        shutil.rmtree(www)
    os.makedirs(www)

    for f in ('index.html', 'manifest.json', 'sw.js'):
        src = os.path.join(PROJ, f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(www, f))

    shutil.copytree(os.path.join(PROJ, 'assets'), os.path.join(www, 'assets'))

    total = 0
    for root, _, files in os.walk(www):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    log('网页资源已打包：%d 个文件，%.0f KB' % (
        sum(len(fs) for _, _, fs in os.walk(www)), total / 1024.0))


def stage_manifest():
    """把版本号写进清单副本。

    为什么必须这么做：aapt2 link 的 --version-code / --version-name 只在清单里
    没写的时候才生效（写了就以内联值为准）。之前清单里一直是 versionCode=3 /
    versionName=1.2，导致系统里所有版本都叫 3，既看不出新旧，也没法据此做在线升级。
    """
    src = io.open(os.path.join(HERE, 'AndroidManifest.xml'), encoding='utf-8').read()
    src = re.sub(r'android:versionCode="[^"]*"', 'android:versionCode="%s"' % VERSION_CODE, src)
    src = re.sub(r'android:versionName="[^"]*"', 'android:versionName="%s"' % VERSION_NAME, src)
    out = os.path.join(BUILD, 'AndroidManifest.xml')
    with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(src)
    log('清单版本号：%s (versionCode %s)' % (VERSION_NAME, VERSION_CODE))
    return out


def build_resources():
    res_zip = os.path.join(BUILD, 'res.zip')
    run([AAPT2, 'compile', '--dir', os.path.join(HERE, 'res'), '-o', res_zip])

    base_apk = os.path.join(BUILD, 'base.apk')
    gen = os.path.join(BUILD, 'gen')
    if os.path.exists(gen):
        shutil.rmtree(gen)

    run([AAPT2, 'link',
         '-o', base_apk,
         '--manifest', os.path.join(BUILD, 'AndroidManifest.xml'),
         '-I', AJAR,
         '-A', os.path.join(BUILD, 'assets'),
         '--java', gen,
         '--min-sdk-version', MIN_SDK,
         '--target-sdk-version', TARGET_SDK,
         '--version-code', VERSION_CODE,
         '--version-name', VERSION_NAME,
         res_zip])
    log('资源已链接：base.apk')
    return base_apk


def build_dex():
    classes = os.path.join(BUILD, 'classes')
    if os.path.exists(classes):
        shutil.rmtree(classes)
    os.makedirs(classes)

    sources = glob.glob(os.path.join(HERE, 'java', '**', '*.java'), recursive=True)
    sources += glob.glob(os.path.join(BUILD, 'gen', '**', '*.java'), recursive=True)
    log('编译 Java 源文件 %d 个' % len(sources))

    run(['javac', '-encoding', 'UTF-8', '-source', '8', '-target', '8',
         '-bootclasspath', AJAR, '-nowarn', '-d', classes] + sources)

    class_files = glob.glob(os.path.join(classes, '**', '*.class'), recursive=True)
    dex_dir = os.path.join(BUILD, 'dex')
    if os.path.exists(dex_dir):
        shutil.rmtree(dex_dir)
    os.makedirs(dex_dir)

    run(['java', '-cp', D8_JAR, 'com.android.tools.r8.D8',
         '--release', '--min-api', MIN_SDK, '--lib', AJAR,
         '--output', dex_dir] + class_files)

    dex = os.path.join(dex_dir, 'classes.dex')
    if not os.path.exists(dex):
        print('d8 未生成 classes.dex')
        sys.exit(1)
    log('classes.dex 已生成：%.0f KB' % (os.path.getsize(dex) / 1024.0))
    return dex


def pack_dex(base_apk, dex):
    packed = os.path.join(BUILD, 'packed.apk')
    if os.path.exists(packed):
        os.remove(packed)
    shutil.copy2(base_apk, packed)
    with zipfile.ZipFile(packed, 'a', zipfile.ZIP_DEFLATED) as z:
        z.write(dex, 'classes.dex')
    log('classes.dex 已写入 APK')
    return packed


def ensure_keystore():
    if os.path.exists(KEYSTORE):
        log('复用已有签名密钥')
        return
    run(['keytool', '-genkeypair', '-keystore', KEYSTORE,
         '-alias', KS_ALIAS, '-keyalg', 'RSA', '-keysize', '2048',
         '-validity', '10000',
         '-storepass', KS_PASS, '-keypass', KS_PASS,
         '-dname', 'CN=PermitGuard, OU=App, O=PermitGuard, L=Beijing, ST=Beijing, C=CN'])
    log('已生成签名密钥 permit-guard.jks')


def align_and_sign(packed):
    aligned = os.path.join(BUILD, 'aligned.apk')
    if os.path.exists(aligned):
        os.remove(aligned)
    run([ZIPALIGN, '-f', '-p', '4', packed, aligned])

    if os.path.exists(OUT_APK):
        os.remove(OUT_APK)
    run(['java', '-jar', SIGNER_JAR, 'sign',
         '--ks', KEYSTORE, '--ks-key-alias', KS_ALIAS,
         '--ks-pass', 'pass:' + KS_PASS, '--key-pass', 'pass:' + KS_PASS,
         '--out', OUT_APK, aligned])

    run(['java', '-jar', SIGNER_JAR, 'verify', '--print-certs', OUT_APK])


def main():
    print('\n=== 作业票助手 · 构建安卓 APK ===\n')
    check_env()
    if os.path.exists(BUILD):
        shutil.rmtree(BUILD)
    os.makedirs(BUILD)

    stage_web_assets()
    stage_manifest()
    base = build_resources()
    dex = build_dex()
    packed = pack_dex(base, dex)
    ensure_keystore()
    align_and_sign(packed)

    size = os.path.getsize(OUT_APK) / 1024.0 / 1024.0
    print('\n=== 构建完成 ===')
    print('APK : ' + OUT_APK)
    print('大小: %.2f MB' % size)
    print('版本: %s (versionCode %s), minSdk %s, targetSdk %s' % (
        VERSION_NAME, VERSION_CODE, MIN_SDK, TARGET_SDK))


if __name__ == '__main__':
    main()
