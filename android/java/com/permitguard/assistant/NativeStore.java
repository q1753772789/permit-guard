package com.permitguard.assistant;

import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * 页面数据的本机持久化（给 JS 的 window.NativeStore）。
 *
 * 为什么需要它：
 * 页面是通过 http://127.0.0.1:<端口> 加载的，localStorage 按 origin 隔离。
 * 只要端口换了（或 WebView 数据被清），之前存的东西就读不到，用户看到的是
 * "重开软件后设置和对话记录全没了"。这里用应用私有目录下的文件做真源，
 * 与端口、origin 都无关，覆盖安装也不会丢。
 *
 * 对应 JS 侧：assets/js/store.js 的 Store.get / set / remove。
 * 只允许本地页面（127.0.0.1）调用，线上备用页拿不到这些数据。
 */
public class NativeStore {

    private static final String DIR = "webstore";

    private final MainActivity host;
    private final File dir;

    NativeStore(MainActivity host) {
        this.host = host;
        this.dir = new File(host.getFilesDir(), DIR);
    }

    /** 只对打进 APK 的本地页面开放 */
    private boolean allowed() {
        return host != null && host.localPage();
    }

    /** key 直接当文件名，限制字符集，避免路径穿越 */
    private boolean validKey(String k) {
        if (k == null || k.length() == 0 || k.length() > 64) return false;
        for (int i = 0; i < k.length(); i++) {
            char c = k.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9') || c == '_' || c == '-';
            if (!ok) return false;
        }
        return true;
    }

    @JavascriptInterface
    public String get(String key) {
        if (!allowed() || !validKey(key)) return null;
        File f = new File(dir, key);
        if (!f.isFile()) return null;
        InputStream in = null;
        try {
            in = new FileInputStream(f);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return new String(bos.toByteArray(), "UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (in != null) {
                try { in.close(); } catch (IOException ignored) { }
            }
        }
    }

    @JavascriptInterface
    public void set(String key, String value) {
        if (!allowed() || !validKey(key) || value == null) return;
        if (!dir.isDirectory() && !dir.mkdirs()) return;

        File tmp = new File(dir, key + ".tmp");
        File dst = new File(dir, key);
        FileOutputStream os = null;
        try {
            os = new FileOutputStream(tmp);
            os.write(value.getBytes("UTF-8"));
            os.flush();
        } catch (Exception e) {
            return;
        } finally {
            if (os != null) {
                try { os.close(); } catch (IOException ignored) { }
            }
        }
        // 先写临时文件再改名：写到一半被系统杀掉也不会留下半个文件。
        // 故意不调 fsync——对话记录带截图时可能几 MB，fsync 会让"回答结束"那一下明显卡顿；
        // 进程被杀不丢（数据已进 page cache），只有整机掉电才可能丢最后一次写入。
        if (!tmp.renameTo(dst)) {
            if (dst.exists()) dst.delete();
            tmp.renameTo(dst);
        }
    }

    @JavascriptInterface
    public void remove(String key) {
        if (!allowed() || !validKey(key)) return;
        File f = new File(dir, key);
        if (f.isFile()) f.delete();
        File tmp = new File(dir, key + ".tmp");
        if (tmp.isFile()) tmp.delete();
    }

    @JavascriptInterface
    public String keys() {
        if (!allowed()) return "[]";
        String[] names = dir.list();
        if (names == null) return "[]";
        StringBuilder sb = new StringBuilder("[");
        int n = 0;
        for (String name : names) {
            if (!validKey(name)) continue;   // 跳过 .tmp 等中间文件
            if (!new File(dir, name).isFile()) continue;
            if (n > 0) sb.append(',');
            sb.append('"').append(name).append('"');
            n++;
        }
        return sb.append(']').toString();
    }
}
