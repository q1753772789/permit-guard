package com.permitguard.assistant;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URLDecoder;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 极简 HTTP 服务器，只监听 127.0.0.1，提供两件事：
 *
 * 1) 把 APK 内 assets/www 的静态资源暴露出来。
 *    为什么要它：WebView 直接加载 file:// 会拿不到正常的 Origin，
 *    localStorage、fetch 跨域、相对路径都可能出问题；127.0.0.1 是标准来源，
 *    行为与浏览器一致，而且完全离线可用（化工现场经常没信号）。
 *
 * 2) /__relay?u=<目标地址>  —— 大模型接口的转发通道。
 *    为什么要它：智谱等国内厂商的接口对 POST 会返回 Access-Control-Allow-Origin，
 *    但对 OPTIONS 预检不返回任何 CORS 头。浏览器只要带 Authorization 头就必须先预检，
 *    预检被拒 → fetch 抛 Failed to fetch。WebView 里同样如此，所以只能由原生层代发。
 *    页面（同源）POST 到本机 /__relay，这里用 HttpURLConnection 真正发出去，
 *    再把响应按 SSE 分块 flush 回来，流式输出不受影响。
 */
public class LocalServer {

    /** 允许转发的域名白名单，避免这套本机通道被当成任意代理使用 */
    private static final String[] ALLOW_HOSTS = {
            "open.bigmodel.cn",
            "bigmodel.cn",
            "api.deepseek.com",
            "dashscope.aliyuncs.com",
            "api.moonshot.cn",
            "api.openai.com",
            "api.anthropic.com",
            "generativelanguage.googleapis.com"
    };

    /** 需要透传给上游的请求头 */
    private static final String[] PASS_HEADERS = {
            "authorization",
            "content-type",
            "accept",
            "x-api-key",
            "anthropic-version",
            "anthropic-dangerous-direct-browser-access",
            "x-goog-api-key"
    };

    private final AssetManager assets;

    /**
     * 热更新目录（可为 null）。
     * 这里没有文件就去 assets/www 里找——所以更新包只需要放改动过的文件，
     * 也可以整包覆盖；两者同时存在时以更新目录为准。
     */
    private volatile File webRoot;

    private ServerSocket socket;
    private volatile boolean running = true;
    private int port;

    /**
     * 固定端口优先。
     *
     * 为什么不能随机：页面 origin 就是 http://127.0.0.1:端口，而 localStorage
     * 按 origin 隔离。端口一变，之前存进去的设置和对话记录（在旧 origin 下）
     * 就读不到了，用户看到的就是"重开软件后设置和对话全没了"。
     * 所以这里固定一组端口依次尝试，全被占用才退回随机端口（此时靠 Store 的
     * 原生文件备份兜底，数据仍然不丢）。
     */
    private static final int[] PREFERRED_PORTS = {47821, 47822, 47823, 47824, 47825};

    public LocalServer(AssetManager assets) {
        this(assets, null);
    }

    public LocalServer(AssetManager assets, File webRoot) {
        this.assets = assets;
        this.webRoot = webRoot;
    }

    /** 热更新应用后切换目录，页面重新加载即生效（无需重启进程） */
    public void setWebRoot(File dir) {
        this.webRoot = dir;
    }

    public File webRoot() {
        return webRoot;
    }

    /** 绑定端口并开始接受连接，返回端口号 */
    public int start() throws IOException {
        ServerSocket ss = null;
        for (int p : PREFERRED_PORTS) {
            try {
                ss = bind(p);
                break;
            } catch (IOException ignored) {
                ss = null;
            }
        }
        if (ss == null) ss = bind(0);
        socket = ss;
        port = ss.getLocalPort();

        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                while (running) {
                    try {
                        final Socket c = socket.accept();
                        Thread worker = new Thread(new Runnable() {
                            @Override
                            public void run() {
                                handle(c);
                            }
                        });
                        worker.setDaemon(true);
                        worker.start();
                    } catch (IOException e) {
                        break;
                    }
                }
            }
        }, "asset-server");
        t.setDaemon(true);
        t.start();
        return port;
    }

    public int port() {
        return port;
    }

    /** 绑定本机回环端口；SO_REUSEADDR 让进程重启后能立刻重新拿到同一端口 */
    private ServerSocket bind(int p) throws IOException {
        ServerSocket ss = new ServerSocket();
        ss.setReuseAddress(true);
        ss.bind(new java.net.InetSocketAddress(InetAddress.getByName("127.0.0.1"), p), 16);
        return ss;
    }

    public void stop() {
        running = false;
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
        }
    }

    /* ============================================================ 请求处理 */

    private void handle(Socket c) {
        try {
            c.setSoTimeout(60000);
            InputStream in = c.getInputStream();
            OutputStream out = c.getOutputStream();

            String head = readHead(in);
            if (head == null) {
                c.close();
                return;
            }

            String[] lines = head.split("\r\n");
            if (lines.length == 0) {
                c.close();
                return;
            }
            String[] parts = lines[0].split(" ");
            String method = parts.length > 0 ? parts[0] : "GET";
            String target = parts.length > 1 ? parts[1] : "/";

            Map<String, String> headers = new LinkedHashMap<String, String>();
            for (int i = 1; i < lines.length; i++) {
                int colon = lines[i].indexOf(':');
                if (colon <= 0) continue;
                headers.put(lines[i].substring(0, colon).trim().toLowerCase(Locale.US),
                        lines[i].substring(colon + 1).trim());
            }

            String path = target;
            String query = "";
            int q = target.indexOf('?');
            if (q >= 0) {
                path = target.substring(0, q);
                query = target.substring(q + 1);
            }
            String frag = path;
            int h = frag.indexOf('#');
            if (h >= 0) path = frag.substring(0, h);

            if ("/__relay".equals(path)) {
                byte[] body = readBody(in, headers);
                relay(method, query, headers, body, out);
                c.close();
                return;
            }

            path = decode(path);
            if (path.length() == 0 || "/".equals(path)) path = "/index.html";
            if (path.contains("..")) path = "/index.html";

            byte[] body = readAsset(path);
            if (body == null) {
                body = "404 Not Found".getBytes("UTF-8");
                writeHead(out, "404 Not Found", "text/plain; charset=utf-8", body.length);
            } else {
                writeHead(out, "200 OK", mime(path), body.length);
            }
            out.write(body);
            out.flush();
            c.close();
        } catch (Exception ignored) {
            try {
                c.close();
            } catch (IOException ignored2) {
            }
        }
    }

    /** 逐字节读到空行为止，避免用 Reader 破坏后续二进制请求体 */
    private String readHead(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int prev3 = -1, prev2 = -1, prev1 = -1;
        int b;
        while ((b = in.read()) != -1) {
            buf.write(b);
            if ((prev3 == '\r' && prev2 == '\n' && prev1 == '\r' && b == '\n')
                    || (prev3 == '\n' && prev2 == '\n')) {
                break;
            }
            prev3 = prev2;
            prev2 = prev1;
            prev1 = b;
            if (buf.size() > 131072) break;
        }
        if (buf.size() == 0) return null;
        return new String(buf.toByteArray(), "UTF-8");
    }

    private byte[] readBody(InputStream in, Map<String, String> headers) throws IOException {
        int len = -1;
        String cl = headers.get("content-length");
        if (cl != null) {
            try {
                len = Integer.parseInt(cl.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        if (len <= 0) return new byte[0];
        if (len > 32 * 1024 * 1024) len = 32 * 1024 * 1024;
        byte[] body = new byte[len];
        int off = 0;
        while (off < len) {
            int n = in.read(body, off, len - off);
            if (n < 0) break;
            off += n;
        }
        if (off == len) return body;
        byte[] cut = new byte[off];
        System.arraycopy(body, 0, cut, 0, off);
        return cut;
    }

    /* ============================================================ 转发 */

    private void relay(String method, String query, Map<String, String> headers, byte[] body, OutputStream out) throws IOException {
        String target = param(query, "u");
        if (target == null || target.length() == 0) {
            fail(out, 400, "缺少目标地址参数 u");
            return;
        }
        URI uri;
        try {
            uri = new URI(target);
        } catch (Exception e) {
            fail(out, 400, "目标地址格式不正确");
            return;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            fail(out, 400, "只支持 http/https 地址");
            return;
        }
        if (!hostAllowed(host)) {
            fail(out, 403, "该域名不在转发白名单内：" + host);
            return;
        }

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("POST".equals(method) ? "POST" : "GET");
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(180000);
            conn.setDoInput(true);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept-Encoding", "identity");

            for (String key : PASS_HEADERS) {
                String v = headers.get(key);
                if (v != null && v.length() > 0) conn.setRequestProperty(key, v);
            }
            conn.setRequestProperty("User-Agent", "PermitGuard/1.2 (Android)");

            if ("POST".equals(method)) {
                conn.setDoOutput(true);
                // 注意：这里不能用 setFixedLengthStreamingMode。
                // 一旦走流式写，上游返回 401 时会抛 HttpRetryException 且拿不到错误响应体，
                // 用户就看不到「令牌已过期」这类具体原因。请求体是 JSON，直接缓冲即可。
                OutputStream os = conn.getOutputStream();
                os.write(body);
                os.flush();
                try {
                    os.close();
                } catch (IOException ignored) {
                }
            }

            int code = conn.getResponseCode();
            String type = conn.getContentType();
            if (type == null) type = "application/json; charset=utf-8";

            StringBuilder sb = new StringBuilder();
            sb.append("HTTP/1.1 ").append(code).append(' ').append(code == 200 ? "OK" : "STATUS").append("\r\n");
            sb.append("Content-Type: ").append(type).append("\r\n");
            sb.append("Cache-Control: no-store\r\n");
            sb.append("X-Relay-Status: ").append(code).append("\r\n");
            sb.append("Transfer-Encoding: chunked\r\n");
            sb.append("Connection: close\r\n\r\n");
            out.write(sb.toString().getBytes("UTF-8"));
            out.flush();

            InputStream is = null;
            try {
                is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            } catch (IOException e) {
                is = conn.getErrorStream();
            }
            if (is != null) {
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) > 0) {
                    out.write((Integer.toHexString(n) + "\r\n").getBytes("US-ASCII"));
                    out.write(buf, 0, n);
                    out.write("\r\n".getBytes("US-ASCII"));
                    out.flush();
                }
                try {
                    is.close();
                } catch (IOException ignored) {
                }
            }
            out.write("0\r\n\r\n".getBytes("US-ASCII"));
            out.flush();
        } catch (Exception e) {
            String msg = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "" : e.getMessage());
            fail(out, 502, "转发失败 " + msg);
        } finally {
            if (conn != null) {
                try {
                    conn.disconnect();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private void fail(OutputStream out, int code, String msg) throws IOException {
        byte[] b = ("{\"error\":{\"code\":\"relay_error\",\"message\":\"" + msg.replace("\"", "'") + "\"}}").getBytes("UTF-8");
        String head = "HTTP/1.1 " + code + " Error\r\n"
                + "Content-Type: application/json; charset=utf-8\r\n"
                + "Content-Length: " + b.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n";
        out.write(head.getBytes("UTF-8"));
        out.write(b);
        out.flush();
    }

    private boolean hostAllowed(String host) {
        for (String h : ALLOW_HOSTS) {
            if (host.equals(h) || host.endsWith("." + h)) return true;
        }
        return false;
    }

    private String param(String query, String key) {
        if (query == null) return null;
        for (String kv : query.split("&")) {
            int eq = kv.indexOf('=');
            if (eq < 0) continue;
            if (key.equals(decode(kv.substring(0, eq)))) return decode(kv.substring(eq + 1));
        }
        return null;
    }

    private String decode(String s) {
        try {
            return URLDecoder.decode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }

    /* ============================================================ 静态资源 */

    private byte[] readAsset(String path) {
        // 1) 热更新目录优先：更新包里有的文件以它为准
        File root = webRoot;
        if (root != null) {
            try {
                File f = new File(root, path);
                if (f.isFile() && f.length() > 0) {
                    String base = root.getCanonicalPath() + File.separator;
                    if (f.getCanonicalPath().startsWith(base)) return readFile(f);
                }
            } catch (Exception ignored) {
            }
        }
        // 2) 回落到 APK 内置资源
        InputStream is = null;
        try {
            is = assets.open("www" + path);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } catch (Exception e) {
            return null;
        } finally {
            if (is != null) {
                try {
                    is.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    private byte[] readFile(File f) throws IOException {
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

    private void writeHead(OutputStream out, String status, String type, int len) throws IOException {
        String head = "HTTP/1.1 " + status + "\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + len + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n";
        out.write(head.getBytes("UTF-8"));
    }

    private String mime(String p) {
        String s = p.toLowerCase(Locale.US);
        if (s.endsWith(".html") || s.endsWith(".htm")) return "text/html; charset=utf-8";
        if (s.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (s.endsWith(".css")) return "text/css; charset=utf-8";
        if (s.endsWith(".json") || s.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (s.endsWith(".png")) return "image/png";
        if (s.endsWith(".jpg") || s.endsWith(".jpeg")) return "image/jpeg";
        if (s.endsWith(".svg")) return "image/svg+xml";
        if (s.endsWith(".ico")) return "image/x-icon";
        if (s.endsWith(".woff2")) return "font/woff2";
        if (s.endsWith(".txt")) return "text/plain; charset=utf-8";
        return "application/octet-stream";
    }
}
