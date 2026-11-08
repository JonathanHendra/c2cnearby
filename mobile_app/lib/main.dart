import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase Auth is the only identity provider. When the native config is
  // missing the app must still boot in browse-only mode instead of crashing.
  try {
    await Firebase.initializeApp();
  } catch (error) {
    debugPrint('Firebase belum siap: $error');
  }

  runApp(const ProviderScope(child: C2CNearbyApp()));
}
