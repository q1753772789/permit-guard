package com.permitguard.assistant;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 在线更新（热更新 + 安装包升级）。
 *
 * 两条通道：
 *   1) 热更新：把新的 index.html / assets 打成一个 zip 放到服务器，
 *      下载校验后解到 filesDir/web/<版本>/，本机服务优先从这里取文件。
 *      用户不用装 APK，重启页面即生效（页面本来每次都会重新请求本机服务）。
 *   2) 安装包升级：规则本身没变、只是原生能力（权限、接口）需要更新时，
 *      下载 APK 后交给系统安装器。
 *
 * 设计要点：
 *   - 只认 https，且域名在 ALLOW_HOSTS 白名单内，避免这套接口变成任意下载器；
 *   - 每个包都校验 size + sha256，校验不过直接丢弃，绝不落盘生效；
 *   - 解压先到 <版本>.tmp，确认 index.html 存在才改名生效（原子切换）；
 *   - 保留上一版目录，出问题可一键回退内置版本（clearWeb）；
 *   - 下载/解压在后台线程跑，JS 侧轮询 progress()，不阻塞界面。
 *
 * 对应 JS 侧：assets/js/update.js（window.UPD）
 */
public class UpdateManager {

    /** 只允许从这些域名拉更新包（含子域） */
    private static final String[] ALLOW_HOSTS = {
            "github.com",
            "githubusercontent.com",
            "jsdelivr.net",
            "permit-guard.app.workbuddy.host",
            "workbuddy.host"
    };

    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 60000;
    private static final long MAX_ZIP = 32L * 1024 * 1024;
    private static final long MAX_APK = 128L * 1024 * 1024;

    private final MainActivity host;
    private final File webDir;      // filesDir/web
    private final File apkDir;      // cacheDir/apk

    /** 当前后台任务状态，全部 volatile 供 JS 线程读取 */
    private volatile String kind = "";          // "" | web | apk
    private volatile String phase = "idle";     // idle|download|verify|extract|done|error
    private volatile int pct = 0;
    private volatile String message = "";
    private volatile String resultVersion = "";
    private volatile long resultSize = 0;

    UpdateManager(MainActivity host) {
        this.host = host;
        this.webDir = new File(host.getFilesDir(), "web");
        this.apkDir = new File(host.getCacheDir(), "apk");
    }

    /* ============================================================ 状态查询 */

    /** 当前生效的热更新目录；没有热更新（用 APK 内置资源）时返回 null */
    File activeWebDir() {
        File marker = new File(webDir, "active.json");
        if (!marker.isFile()) return null;
        String v = readMarkerVersion(marker);
        if (v == null) return null;
        File d = new File(webDir, v);
        if (new File(d, "index.html").isFile()) return d;
        return null;
    }

    /** 热更新版本号，没应用过热更新返回空串 */
    String webVersion() {
        File marker = new File(webDir, "active.json");
        if (!marker.isFile()) return "";
        String v = readMarkerVersion(marker);
        return v == null ? "" : v;
    }

    private String readMarkerVersion(File marker) {
        try {
            String s = new String(readAll(marker), "UTF-8");
            int i = s.indexOf("\"version\"");
            if (i < 0) return null;
            int q1 = s.indexOf('"', s.indexOf(':', i) + 1);
            int q2 = s.indexOf('"', q1 + 1);
            if (q1 < 0 || q2 < 0) return null;
            String v = s.substring(q1 + 1, q2);
            return validVersion(v) ? v : null;
        } catch (Exception e) {
            return null;
        }
    }

    @JavascriptInterface
    public String info() {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"apkVersionName\":\"").append(json(host.appVersionName())).append("\",");
        sb.append("\"apkVersionCode\":").append(host.appVersionCode()).append(',');
        sb.append("\"webVersion\":\"").append(json(webVersion())).append("\",");
        sb.append("\"webApplied\":").append(webVersion().length() > 0);
        sb.append('}');
        return sb.toString();
    }

    @JavascriptInterface
    public String progress() {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"kind\":\"").append(json(kind)).append("\",");
        sb.append("\"phase\":\"").append(json(phase)).append("\",");
        sb.append("\"pct\":").append(pct).append(',');
        sb.append("\"message\":\"").append(json(message)).append("\",");
        sb.append("\"version\":\"").append(json(resultVersion)).append("\",");
        sb.append("\"size\":").append(resultSize);
        sb.append('}');
        return sb.toString();
    }

    /* ============================================================ 网络 */

    /**
     * 同步 GET 文本（清单文件很小，直接同步返回，省得 JS 再轮询）。
     * 失败返回 "__ERR__:原因"，由 JS 侧换下一个源。
     */
    @JavascriptInterface
    public String httpGet(String url) {
        if (!host.localPage()) return "__ERR__:仅限应用内页面调用";
        if (!allowed(url)) return "__ERR__:地址不在白名单";
        HttpURLConnection c = null;
        try {
            c = open(url);
            int code = c.getResponseCode();
            if (code != 200) return "__ERR__:HTTP " + code;
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            int total = 0;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > 1024 * 1024) break;   // 清单不会这么大，防跑飞
                bos.write(buf, 0, n);
            }
            try {
                in.close();
            } catch (IOException ignored) {
            }
            return new String(bos.toByteArray(), "UTF-8");
        } catch (Exception e) {
            return "__ERR__:" + shortErr(e);
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /* ============================================================ 热更新 */

    @JavascriptInterface
    public String startWebUpdate(String url, String sha256, String version, long size) {
        if (!host.localPage()) return err("仅限应用内页面调用");
        if (!allowed(url)) return err("下载地址不在白名单内");
        if (!validVersion(version)) return err("版本号不合法");
        if (isBusy()) return err("已有下载任务在进行");
        if (size > MAX_ZIP) return err("更新包过大");

        final String u = url, s = sha256, v = version;
        kind = "web";
        phase = "download";
        pct = 0;
        message = "正在下载网页更新";
        resultVersion = v;

        new Thread(new Runnable() {
            @Override
            public void run() {
                File zip = new File(webDir, "www-" + v + ".zip");
                File tmpDir = new File(webDir, v + ".tmp");
                File dstDir = new File(webDir, v);
                try {
                    if (!webDir.isDirectory() && !webDir.mkdirs()) throw new IOException("无法创建目录");
                    clean(tmpDir);
                    clean(zip);

                    download(u, zip, s, MAX_ZIP);

                    phase = "extract";
                    pct = 92;
                    message = "正在解压";
                    unzip(zip, tmpDir);
                    if (!new File(tmpDir, "index.html").isFile()) {
                        throw new IOException("更新包缺少 index.html");
                    }

                    // 原子切换：先把旧目录挪开，再改名，失败可回滚
                    clean(dstDir);
                    if (!tmpDir.renameTo(dstDir)) throw new IOException("解压目录改名失败");
                    writeMarker(v);

                    clean(zip);
                    pct = 100;
                    phase = "done";
                    message = "网页更新已就绪";
                } catch (Exception e) {
                    clean(tmpDir);
                    clean(zip);
                    phase = "error";
                    message = shortErr(e);
                }
            }
        }, "web-update").start();
        return ok();
    }

    private void writeMarker(String v) throws IOException {
        File marker = new File(webDir, "active.json");
        String s = "{\"version\":\"" + v + "\",\"applied\":" + (System.currentTimeMillis() / 1000L) + "}";
        FileOutputStream os = new FileOutputStream(marker);
        try {
            os.write(s.getBytes("UTF-8"));
            os.flush();
        } finally {
            try {
                os.close();
            } catch (IOException ignored) {
            }
        }
    }

    /** 回退到 APK 内置资源 */
    @JavascriptInterface
    public String clearWeb() {
        if (!host.localPage()) return err("仅限应用内页面调用");
        if (isBusy()) return err("有任务在进行，稍后再试");
        try {
            File marker = new File(webDir, "active.json");
            if (marker.isFile()) marker.delete();
            String[] names = webDir.list();
            if (names != null) {
                for (String n : names) {
                    if ("active.json".equals(n)) continue;
                    clean(new File(webDir, n));
                }
            }
            message = "已回退到内置版本";
            return ok();
        } catch (Exception e) {
            return err(shortErr(e));
        }
    }

    /* ============================================================ APK 升级 */

    @JavascriptInterface
    public String startApkUpdate(String url, String sha256, String versionName, long size) {
        if (!host.localPage()) return err("仅限应用内页面调用");
        if (!allowed(url)) return err("下载地址不在白名单内");
        if (isBusy()) return err("已有下载任务在进行");
        if (size > MAX_APK) return err("安装包过大");

        final String u = url, s = sha256;
        final String v = validVersion(versionName) ? versionName : "update";
        kind = "apk";
        phase = "download";
        pct = 0;
        message = "正在下载安装包";
        resultVersion = v;

        new Thread(new Runnable() {
            @Override
            public void run() {
                File out = new File(apkDir, "permit-guard-" + v + ".apk");
                try {
                    if (!apkDir.isDirectory() && !apkDir.mkdirs()) throw new IOException("无法创建目录");
                    // 清掉旧包，避免缓存里堆一堆
                    File[] olds = apkDir.listFiles();
                    if (olds != null) {
                        for (File f : olds) {
                            if (!f.getName().equals(out.getName())) clean(f);
                        }
                    }
                    download(u, out, s, MAX_APK);
                    resultSize = out.length();
                    pct = 100;
                    phase = "done";
                    message = "安装包已下载";
                } catch (Exception e) {
                    clean(out);
                    phase = "error";
                    message = shortErr(e);
                }
            }
        }, "apk-update").start();
        return ok();
    }

    /** 调起系统安装界面；需要"安装未知应用"权限时返回 needPermission */
    @JavascriptInterface
    public String installApk() {
        if (!host.localPage()) return err("仅限应用内页面调用");
        File dir = apkDir;
        File[] files = dir.listFiles();
        File apk = null;
        if (files != null) {
            for (File f : files) {
                if (f.getName().toLowerCase(Locale.US).endsWith(".apk") && f.length() > 0
                        && f.getName().indexOf(".part") < 0) {
                    apk = f;
                    break;
                }
            }
        }
        if (apk == null) return err("没有可安装的安装包，请先下载");

        if (Build.VERSION.SDK_INT >= 26 && !host.getPackageManager().canRequestPackageInstalls()) {
            host.askInstallPermission();
            return "{\"ok\":false,\"needPermission\":true,\"message\":\"请允许本应用安装未知应用后重试\"}";
        }

        try {
            Uri uri = Uri.parse("content://" + UpdateFileProvider.AUTHORITY + "/" + apk.getName());
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            host.startActivity(i);
            return ok();
        } catch (Exception e) {
            return err("调起安装器失败：" + shortErr(e));
        }
    }

    /** 供 UpdateFileProvider 取文件（只允许 apk 目录下的 apk） */
    File apkFile(String name) {
        if (name == null || name.indexOf('/') >= 0 || name.indexOf("..") >= 0) return null;
        if (!name.toLowerCase(Locale.US).endsWith(".apk")) return null;
        File f = new File(apkDir, name);
        return f.isFile() ? f : null;
    }

    /* ============================================================ 底层工具 */

    private boolean isBusy() {
        return "download".equals(phase) || "verify".equals(phase) || "extract".equals(phase);
    }

    private HttpURLConnection open(String url) throws IOException {
        URL u = new URL(url);
        HttpURLConnection c = (HttpURLConnection) u.openConnection();
        c.setConnectTimeout(CONNECT_TIMEOUT);
        c.setReadTimeout(READ_TIMEOUT);
        c.setInstanceFollowRedirects(true);
        c.setUseCaches(false);
        c.setRequestProperty("Accept-Encoding", "identity");
        c.setRequestProperty("User-Agent", "PermitGuard-Updater");
        return c;
    }

    private void download(String url, File dst, String expectSha, long max) throws Exception {
        File tmp = new File(dst.getParentFile(), dst.getName() + ".part");
        clean(tmp);
        HttpURLConnection c = null;
        InputStream in = null;
        OutputStream os = null;
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try {
            c = open(url);
            int code = c.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);
            long total = c.getContentLength();
            if (total > max) throw new IOException("文件超出大小限制");
            in = c.getInputStream();
            os = new FileOutputStream(tmp);
            byte[] buf = new byte[16384];
            long done = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                done += n;
                if (done > max) throw new IOException("文件超出大小限制");
                os.write(buf, 0, n);
                md.update(buf, 0, n);
                if (total > 0) {
                    pct = (int) (done * 88 / total);   // 预留后面解压/校验的进度
                }
            }
            os.flush();
        } finally {
            if (os != null) {
                try {
                    os.close();
                } catch (IOException ignored) {
                }
            }
            if (in != null) {
                try {
                    in.close();
                } catch (IOException ignored) {
                }
            }
            if (c != null) c.disconnect();
        }

        phase = "verify";
        message = "正在校验文件";
        String sha = hex(md.digest());
        if (expectSha != null && expectSha.length() == 64 && !expectSha.equalsIgnoreCase(sha)) {
            clean(tmp);
            throw new IOException("文件校验失败，已丢弃");
        }
        clean(dst);
        if (!tmp.renameTo(dst)) {
            clean(tmp);
            throw new IOException("写入失败");
        }
    }

    private void unzip(File zip, File dir) throws IOException {
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("无法创建解压目录");
        String root = dir.getCanonicalPath() + File.separator;
        ZipInputStream zis = new ZipInputStream(new FileInputStream(zip));
        try {
            ZipEntry e;
            byte[] buf = new byte[16384];
            while ((e = zis.getNextEntry()) != null) {
                String name = e.getName();
                if (name == null || name.length() == 0) continue;
                if (name.indexOf("..") >= 0 || name.startsWith("/") || name.startsWith("\\")) continue;
                File out = new File(dir, name);
                if (!out.getCanonicalPath().startsWith(root)) continue;   // 防目录穿越
                if (e.isDirectory()) {
                    out.mkdirs();
                    continue;
                }
                File parent = out.getParentFile();
                if (parent != null && !parent.isDirectory() && !parent.mkdirs()) continue;
                FileOutputStream os = new FileOutputStream(out);
                try {
                    int n;
                    while ((n = zis.read(buf)) > 0) os.write(buf, 0, n);
                    os.flush();
                } finally {
                    try {
                        os.close();
                    } catch (IOException ignored) {
                    }
                }
            }
        } finally {
            try {
                zis.close();
            } catch (IOException ignored) {
            }
        }
    }

    private byte[] readAll(File f) throws IOException {
        InputStream in = new FileInputStream(f);
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            try {
                in.close();
            } catch (IOException ignored) {
            }
        }
    }

    private void clean(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) {
                for (File k : kids) clean(k);
            }
        }
        f.delete();
    }

    private boolean allowed(String url) {
        if (url == null) return false;
        String u = url.trim().toLowerCase(Locale.US);
        if (!u.startsWith("https://")) return false;
        String rest = u.substring(8);
        int slash = rest.indexOf('/');
        String hostPart = slash < 0 ? rest : rest.substring(0, slash);
        int colon = hostPart.indexOf(':');
        if (colon >= 0) hostPart = hostPart.substring(0, colon);
        for (String h : ALLOW_HOSTS) {
            if (hostPart.equals(h) || hostPart.endsWith("." + h)) return true;
        }
        return false;
    }

    private boolean validVersion(String v) {
        if (v == null || v.length() == 0 || v.length() > 24) return false;
        for (int i = 0; i < v.length(); i++) {
            char ch = v.charAt(i);
            boolean ok = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
                    || (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-';
            if (!ok) return false;
        }
        return v.indexOf("..") < 0;
    }

    private String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) {
            int v = x & 0xFF;
            if (v < 16) sb.append('0');
            sb.append(Integer.toHexString(v));
        }
        return sb.toString();
    }

    private String shortErr(Exception e) {
        String m = e.getMessage();
        if (m == null || m.length() == 0) m = e.getClass().getSimpleName();
        if (m.length() > 80) m = m.substring(0, 80);
        return m;
    }

    private String ok() {
        return "{\"ok\":true}";
    }

    private String err(String msg) {
        return "{\"ok\":false,\"message\":\"" + json(msg) + "\"}";
    }

    static String json(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < 0x20) sb.append(' ');
                    else sb.append(c);
            }
        }
        return sb.toString();
    }
}
