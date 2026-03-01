import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

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
    return MaterialApp(
      title: 'Waldiez Player (Flutter)',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0EA5E9)),
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
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _errorText;
  String _activeUrl = '';
  bool _triedHostedFallback = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            setState(() {
              _isLoading = true;
              _errorText = null;
            });
          },
          onPageFinished: (_) {
            setState(() => _isLoading = false);
          },
          onWebResourceError: (error) {
            final bool localFailed = _activeUrl.startsWith(_localUrl);
            if (localFailed && !_triedHostedFallback) {
              _triedHostedFallback = true;
              final String hosted = _withYtApiKey(_hostedUrl);
              setState(() {
                _activeUrl = hosted;
                _isLoading = true;
                _errorText = null;
              });
              unawaited(_controller.loadRequest(Uri.parse(hosted)));
              return;
            }
            setState(() {
              _isLoading = false;
              _errorText = 'Failed to load web UI: ${error.description}';
            });
          },
        ),
      );
    unawaited(_loadInitialUrl());
  }

  Future<void> _loadInitialUrl() async {
    final String startUrl = _withYtApiKey(await _resolveStartUrl());
    setState(() => _activeUrl = startUrl);
    await _controller.loadRequest(Uri.parse(startUrl));
  }

  String _withYtApiKey(String baseUrl) {
    if (_ytApiKey.trim().isEmpty) return baseUrl;
    final Uri uri = Uri.parse(baseUrl);
    final Map<String, String> q = Map<String, String>.from(uri.queryParameters);
    q['yt_api_key'] = _ytApiKey.trim();
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
    if (!(Platform.isMacOS || Platform.isLinux || Platform.isWindows)) {
      return false;
    }
    try {
      final HttpClient client = HttpClient()..connectionTimeout = const Duration(seconds: 2);
      final HttpClientRequest request = await client.getUrl(Uri.parse(_localUrl));
      request.headers.add(HttpHeaders.userAgentHeader, 'player_flutter_probe');
      final HttpClientResponse response = await request.close();
      client.close(force: true);
      return response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading) const Center(child: CircularProgressIndicator()),
          if (!_isLoading && _errorText != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  _errorText!,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
