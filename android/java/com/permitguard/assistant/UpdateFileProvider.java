package com.permitguard.assistant;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Locale;

/**
 * 极小的文件共享 provider，只为把下载好的 APK 交给系统安装器。
 *
 * 为什么不用 androidx.core 的 FileProvider：本项目手工打包、只依赖 android.jar，
 * 不引第三方库。这里只需实现 openFile + query（安装器要读文件名和大小）。
 *
 * 权限范围收紧到 cacheDir/apk/ 下的 .apk，别的文件一律不给。
 * 对应清单里的 <provider android:authorities="com.permitguard.assistant.updates">。
 */
public class UpdateFileProvider extends ContentProvider {

    public static final String AUTHORITY = "com.permitguard.assistant.updates";

    private File dir() {
        return new File(getContext().getCacheDir(), "apk");
    }

    private File resolve(Uri uri) throws FileNotFoundException {
        String name = uri == null ? null : uri.getLastPathSegment();
        if (name == null || name.length() == 0
                || name.indexOf('/') >= 0 || name.indexOf("..") >= 0
                || !name.toLowerCase(Locale.US).endsWith(".apk")) {
            throw new FileNotFoundException("不允许的文件：" + name);
        }
        File f = new File(dir(), name);
        if (!f.isFile()) throw new FileNotFoundException(name);
        return f;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = resolve(uri);
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        File f;
        try {
            f = resolve(uri);
        } catch (FileNotFoundException e) {
            return null;
        }
        String[] cols = projection != null ? projection
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor c = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
            else row[i] = f.getName();
        }
        c.addRow(row);
        return c;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("只读");
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        throw new UnsupportedOperationException("只读");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        throw new UnsupportedOperationException("只读");
    }
}
