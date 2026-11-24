package com.biharimart.app;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    WebView web;
    Handler handler = new Handler();
    boolean showingSplash = true;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(7, 18, 38));
        getWindow().setNavigationBarColor(Color.rgb(7, 18, 38));

        showSplash();

        handler.postDelayed(() -> openWebsite(), 2800);
    }

    private GradientDrawable gradient(int start, int end, float radius) {
        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{start, end}
        );
        bg.setCornerRadius(radius);
        return bg;
    }

    private void showSplash() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(28, 30, 28, 30);
        root.setBackground(gradient(
            Color.rgb(5, 16, 36),
            Color.rgb(18, 43, 76), 0
        ));

        LinearLayout logo = new LinearLayout(this);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(gradient(
            Color.rgb(210, 174, 94),
            Color.rgb(255, 230, 164), 1000
        ));

        TextView monogram = new TextView(this);
        monogram.setText("BM");
        monogram.setTextColor(Color.rgb(7, 25, 48));
        monogram.setTextSize(42);
        monogram.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        logo.addView(monogram);

        LinearLayout.LayoutParams logoParams =
            new LinearLayout.LayoutParams(150, 150);
        logoParams.gravity = Gravity.CENTER;
        root.addView(logo, logoParams);

        logo.setScaleX(0.65f);
        logo.setScaleY(0.65f);
        logo.setAlpha(0f);
        logo.animate().scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(900)
            .setInterpolator(new DecelerateInterpolator())
            .start();

        TextView brand = new TextView(this);
        brand.setText("BIHARI MART");
        brand.setTextColor(Color.WHITE);
        brand.setTextSize(31);
        brand.setLetterSpacing(0.10f);
        brand.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        brand.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams brandParams =
            new LinearLayout.LayoutParams(-1, -2);
        brandParams.topMargin = 32;
        root.addView(brand, brandParams);

        TextView line = new TextView(this);
        line.setText("GLOBAL INDUSTRIAL MARKETPLACE");
        line.setTextColor(Color.rgb(235, 195, 112));
        line.setTextSize(13);
        line.setLetterSpacing(0.13f);
        line.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lineParams =
            new LinearLayout.LayoutParams(-1, -2);
        lineParams.topMargin = 14;
        root.addView(line, lineParams);

        TextView tagline = new TextView(this);
        tagline.setText("BUY  •  SELL  •  CONNECT");
        tagline.setTextColor(Color.WHITE);
        tagline.setTextSize(15);
        tagline.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tagParams =
            new LinearLayout.LayoutParams(-1, -2);
        tagParams.topMargin = 36;
        root.addView(tagline, tagParams);

        TextView worldwide = new TextView(this);
        worldwide.setText("Industrial Machinery Worldwide");
        worldwide.setTextColor(Color.rgb(195, 207, 222));
        worldwide.setTextSize(14);
        worldwide.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams worldParams =
            new LinearLayout.LayoutParams(-1, -2);
        worldParams.topMargin = 9;
        root.addView(worldwide, worldParams);

        ProgressBar progress = new ProgressBar(this, null,
            android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setProgressTintList(
            android.content.res.ColorStateList.valueOf(
                Color.rgb(235, 195, 112)
            )
        );
        progress.setIndeterminateTintList(
            android.content.res.ColorStateList.valueOf(
                Color.rgb(235, 195, 112)
            )
        );
        LinearLayout.LayoutParams progressParams =
            new LinearLayout.LayoutParams(130, 5);
        progressParams.gravity = Gravity.CENTER;
        progressParams.topMargin = 55;
        root.addView(progress, progressParams);

        TextView loading = new TextView(this);
        loading.setText("WELCOME TO THE FUTURE OF MACHINERY");
        loading.setTextColor(Color.rgb(180, 194, 211));
        loading.setTextSize(9);
        loading.setLetterSpacing(0.08f);
        loading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams loadParams =
            new LinearLayout.LayoutParams(-1, -2);
        loadParams.topMargin = 18;
        root.addView(loading, loadParams);

        setContentView(root);
    }

    private void openWebsite() {
        showingSplash = false;

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());

        setContentView(web);
        web.loadUrl("https://bihari-mart.onrender.com");
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
