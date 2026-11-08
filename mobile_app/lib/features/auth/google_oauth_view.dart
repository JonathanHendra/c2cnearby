import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/config/app_config.dart';
import '../../app/theme/app_theme.dart';

/// One-tap Google sign-in button. Disabled on builds without a Firebase
/// OAuth client id and shows the reason so the user knows how to enable it.
class GoogleOAuthView extends ConsumerWidget {
  const GoogleOAuthView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authProvider);
    final palette = AppPalette.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Google',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: state.busy
                  ? null
                  : () => ref.read(authProvider.notifier).signInWithGoogle(),
              icon: const Icon(Icons.g_mobiledata_rounded, size: 26),
              label: const Text('Masuk dengan Google'),
            ),
            if (state.error != null) ...[
              const SizedBox(height: 6),
              Text(
                state.error!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.danger,
                    ),
              ),
            ] else if (!AppConfig.isGoogleConfigured) ...[
              const SizedBox(height: 6),
              Text(
                'GOOGLE_SERVER_CLIENT_ID belum diisi pada build ini.',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.mutedText,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                'Set --dart-define=GOOGLE_SERVER_CLIENT_ID=... saat build.',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.mutedText,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
