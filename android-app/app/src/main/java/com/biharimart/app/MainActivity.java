package com.biharimart.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;

public class MainActivity extends Activity {
 WebView web;

 @Override
 protected void onCreate(Bundle state) {
  super.onCreate(state);
  web = new WebView(this);
  setContentView(web);
  WebSettings settings = web.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setDatabaseEnabled(true);
  web.setWebViewClient(new WebViewClient());
  web.setWebChromeClient(new WebChromeClient());
  web.loadUrl("https://bihari-mart.onrender.com");
 }

 @Override
 public void onBackPressed() {
  if (web.canGoBack()) web.goBack();
  else super.onBackPressed();
 }
}
