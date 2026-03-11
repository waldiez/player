//
//  Generated file. Do not edit.
//

// clang-format off

#include "generated_plugin_registrant.h"

#include <webview_windows/webview_windows_plugin.h>
#include <zikzak_inappwebview_windows/zikzak_in_app_web_view_windows.h>

void RegisterPlugins(flutter::PluginRegistry* registry) {
  WebviewWindowsPluginRegisterWithRegistrar(
      registry->GetRegistrarForPlugin("WebviewWindowsPlugin"));
  ZikzakInAppWebViewWindowsRegisterWithRegistrar(
      registry->GetRegistrarForPlugin("ZikzakInAppWebViewWindows"));
}
