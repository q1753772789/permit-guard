package com.permitguard.assistant;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.util.ArrayList;

/**
 * 作业票助手 · 安卓壳
 *
 * 页面资源全部打包在 APK 内（assets/www），由本机回环 HTTP 服务提供，
 * 所以断网也能查规则、看易错点、走填票向导；只有 AI 问答需要联网。
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE = 1001;
    private static final String REMOTE_FALLBACK = "https://permit-guard.app.workbuddy.host/";

    private WebView web;
    private LocalServer server;
    private UpdateManager updates;
    private ValueCallback<Uri[]> fileCallback;

    /** 当前加载的页面地址，热更新后用它重新加载 */
    private String pageUrl;

    /** 当前页面是不是打包在本机回环服务上（决定是否放行本机存储接口） */
    private volatile boolean localPage = false;

    boolean localPage() {
        return localPage;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#F7F8FA"));
        w.setNavigationBarColor(Color.parseColor("#FFFFFF"));
        if (Build.VERSION.SDK_INT >= 23) {
            int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 27) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            w.getDecorView().setSystemUiVisibility(flags);
        }

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#F2F3F5"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap favicon) {
                // 只有打包进来的本地页面才允许读写本机存储
                localPage = url != null && url.startsWith("http://127.0.0.1:");
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handleUrl(req.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return handleUrl(Uri.parse(url));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = cb;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择办票截图"), REQ_FILE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "没有找到可用的图片选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        setContentView(web);

        // 设置与对话记录存在本机文件里，不受页面端口变化影响（见 NativeStore）
        web.addJavascriptInterface(new NativeStore(this), "NativeStore");

        // 在线更新：热更新目录（filesDir/web/<版本>）存在时优先用它，否则用 APK 内置资源
        updates = new UpdateManager(this);
        web.addJavascriptInterface(updates, "NativeUpdater");

        String url = REMOTE_FALLBACK;
        try {
            server = new LocalServer(getAssets(), updates.activeWebDir());
            int port = server.start();
            // native=1 告知页面：大模型请求要走本机 /__relay 转发（浏览器直连厂商接口会被预检拦住）
            url = "http://127.0.0.1:" + port + "/index.html?native=1";
        } catch (Exception e) {
            Toast.makeText(this, "本地资源服务启动失败，改用在线版本", Toast.LENGTH_LONG).show();
        }
        pageUrl = url;
        web.loadUrl(url);
    }

    /* ============================================================ 在线更新支持 */

    /** 热更新应用后重新加载页面：先切到新目录，再让 WebView 重新请求 */
    void reloadPage() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (server != null && updates != null) server.setWebRoot(updates.activeWebDir());
                if (web != null && pageUrl != null) web.loadUrl(pageUrl);
            }
        });
    }

    String appVersionName() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.versionName == null ? "" : pi.versionName;
        } catch (Exception e) {
            return "";
        }
    }

    int appVersionCode() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= 28) return (int) pi.getLongVersionCode();
            return pi.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    /** 没有"安装未知应用"权限时，把用户送到本应用的授权页 */
    void askInstallPermission() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, "请允许本应用安装应用，返回后再点一次安装", Toast.LENGTH_LONG).show();
                try {
                    if (Build.VERSION.SDK_INT >= 26) {
                        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                        i.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(i);
                    }
                } catch (Exception ignored) {
                }
            }
        });
    }

    /** 站内链接留在 WebView，站外链接交给系统浏览器 / 拨号 */
    private boolean handleUrl(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();

        if ("http".equals(scheme) || "https".equals(scheme)) {
            if ("127.0.0.1".equals(host) || "localhost".equals(host) || "permit-guard.app.workbuddy.host".equals(host)) {
                return false;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
        if ("tel".equals(scheme) || "mailto".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
        return false;
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req != REQ_FILE) {
            super.onActivityResult(req, result, data);
            return;
        }
        if (fileCallback == null) return;

        Uri[] uris = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                ArrayList<Uri> list = new ArrayList<Uri>();
                for (int i = 0; i < n; i++) {
                    Uri u = data.getClipData().getItemAt(i).getUri();
                    if (u != null) list.add(u);
                }
                if (!list.isEmpty()) uris = list.toArray(new Uri[list.size()]);
            } else if (data.getData() != null) {
                uris = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.stop();
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
        }
        super.onDestroy();
    }
}
