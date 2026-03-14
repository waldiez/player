import 'dart:async';
import 'dart:io'
    show HttpClient, HttpClientRequest, HttpClientResponse, HttpHeaders, Platform, Process;

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:zikzak_inappwebview/zikzak_inappwebview.dart';

const String _localUrl = 'http://localhost:5173';
const String _hostedUrl = 'https://waldiez.github.io/player/';
const String _ytApiKey = String.fromEnvironment('YT_API_KEY');
const String _forcedWebUrl = String.fromEnvironment('PLAYER_WEB_URL');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PlayerFlutterApp());
}

class PlayerFlutterApp extends StatelessWidget {
  const PlayerFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    const Color background = Color(0xFF12121A);
    const Color surface = Color(0xFF1A1B24);
    const Color accent = Color(0xFF0EA5E9);

    return MaterialApp(
      title: 'Waldiez Player',
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(
          primary: accent,
          secondary: accent,
          surface: surface,
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Colors.white,
        ),
        scaffoldBackgroundColor: background,
        canvasColor: background,
        appBarTheme: const AppBarTheme(
          backgroundColor: background,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        progressIndicatorTheme: const ProgressIndicatorThemeData(color: accent),
      ),
      home: const PlayerWebViewPage(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class PlayerWebViewPage extends StatefulWidget {
  const PlayerWebViewPage({super.key});

  @override
  State<PlayerWebViewPage> createState() => _PlayerWebViewPageState();
}

class _PlayerWebViewPageState extends State<PlayerWebViewPage> {
  bool _isLoading = true;
  String? _errorText;
  String _activeUrl = '';
  bool _triedHostedFallback = false;
  InAppWebViewController? _controller;

  @override
  void initState() {
    super.initState();
    unawaited(_loadInitialUrl());
  }

  Future<void> _loadInitialUrl() async {
    final String startUrl = _withYtApiKey(await _resolveStartUrl());
    setState(() {
      _activeUrl = startUrl;
      _isLoading = true;
    });
    if (_controller != null) {
      await _controller!.loadUrl(
        urlRequest: URLRequest(url: WebUri(startUrl)),
      );
    }
  }

  String _withYtApiKey(String baseUrl) {
    final Uri uri = Uri.parse(baseUrl);
    final Map<String, String> q = Map<String, String>.from(uri.queryParameters);
    q['runtime'] = 'flutter_webview';
    if (_ytApiKey.trim().isNotEmpty) {
      q['yt_api_key'] = _ytApiKey.trim();
    }
    return uri.replace(queryParameters: q).toString();
  }

  Future<String> _resolveStartUrl() async {
    if (_forcedWebUrl.trim().isNotEmpty) {
      return _forcedWebUrl.trim();
    }
    final bool localReachable = await _canReachLocalDevServer();
    return localReachable ? _localUrl : _hostedUrl;
  }

  Future<bool> _canReachLocalDevServer() async {
    if (kIsWeb) {
      return false;
    }
    if (!(Platform.isMacOS || Platform.isLinux || Platform.isWindows)) {
      return false;
    }
    try {
      final HttpClient client = HttpClient()..connectionTimeout = const Duration(seconds: 2);
      final HttpClientRequest request = await client.getUrl(Uri.parse(_localUrl));
      request.headers.add(HttpHeaders.userAgentHeader, 'waldiez_player_probe');
      final HttpClientResponse response = await request.close();
      client.close(force: true);
      return response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      return false;
    }
  }

  Future<void> _openInBrowser() async {
    if (_activeUrl.isEmpty) return;
    if (kIsWeb || !(Platform.isLinux || Platform.isMacOS || Platform.isWindows)) {
      return;
    }
    final String opener =
        Platform.isLinux ? 'xdg-open' : Platform.isMacOS ? 'open' : 'start';
    try {
      if (Platform.isWindows) {
        await Process.start('cmd', ['/c', 'start', '', _activeUrl]);
      } else {
        await Process.start(opener, [_activeUrl]);
      }
    } catch (error) {
      setState(() {
        _errorText = 'Failed to open external browser: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          InAppWebView(
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              transparentBackground: false,
              mediaPlaybackRequiresUserGesture: false,
              allowsInlineMediaPlayback: true,
            ),
            initialUrlRequest: _activeUrl.isEmpty
                ? null
                : URLRequest(
                    url: WebUri(_activeUrl),
                  ),
            onWebViewCreated: (controller) {
              _controller = controller;
              if (_activeUrl.isNotEmpty) {
                unawaited(
                  controller.loadUrl(
                    urlRequest: URLRequest(url: WebUri(_activeUrl)),
                  ),
                );
              }
            },
            onLoadStart: (_, uri) {
              setState(() {
                _isLoading = true;
                _errorText = null;
              });
            },
            onLoadStop: (_, uri) async {
              if (mounted) {
                setState(() => _isLoading = false);
              }
            },
            onReceivedError: (_, request, error) {
              final String failingUrl = request.url.toString();
              final bool localFailed = failingUrl.startsWith(_localUrl);
              if (localFailed && !_triedHostedFallback) {
                _triedHostedFallback = true;
                final String hosted = _withYtApiKey(_hostedUrl);
                setState(() {
                  _activeUrl = hosted;
                  _isLoading = true;
                  _errorText = null;
                });
                unawaited(
                  _controller?.loadUrl(
                        urlRequest: URLRequest(url: WebUri(hosted)),
                      ) ??
                      Future<void>.value(),
                );
                return;
              }
              setState(() {
                _isLoading = false;
                _errorText = 'Failed to load web UI: ${error.description}';
              });
            },
          ),
          if (_isLoading) const Center(child: CircularProgressIndicator()),
          if (!_isLoading && _errorText != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _errorText!,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _activeUrl.isEmpty ? null : () => unawaited(_openInBrowser()),
                      child: const Text('Open in browser'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
