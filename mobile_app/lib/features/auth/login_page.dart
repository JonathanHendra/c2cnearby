import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/config/app_config.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);
    final palette = AppPalette.of(context);
    final awaitingCode = state.phoneVerificationId != null;

    ref.listen(authProvider, (previous, next) {
      if (next.isSignedIn && (previous?.isSignedIn != true)) {
        context.go('/profil');
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Masuk')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        children: [
          Text(
            'Satu akun untuk jual, beli, dan ngobrol dengan tetangga.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: palette.mutedText,
                ),
          ),
          const SizedBox(height: 20),
          if (state.notice != null) ...[
            _Banner(
              icon: Icons.info_outline_rounded,
              message: state.notice!,
              color: palette.warningBackground,
              foreground: AppColors.warning,
            ),
            const SizedBox(height: 16),
          ],
          if (state.error != null) ...[
            _Banner(
              icon: Icons.error_outline_rounded,
              message: state.error!,
              color: palette.dangerBackground,
              foreground: AppColors.danger,
            ),
            const SizedBox(height: 16),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Google', style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: state.busy || !AppConfig.isGoogleConfigured
                        ? null
                        : () => ref.read(authProvider.notifier).signInWithGoogle(),
                    icon: const Icon(Icons.g_mobiledata_rounded, size: 26),
                    label: const Text('Masuk dengan Google'),
                  ),
                  if (!AppConfig.isGoogleConfigured) ...[
                    const SizedBox(height: 6),
                    Text(
                      'GOOGLE_SERVER_CLIENT_ID belum diisi pada build ini.',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Nomor telepon', style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 4),
                  Text(
                    'Kode dikirim lewat Firebase Phone Auth. Nomor tidak pernah '
                    'ditampilkan ke pengguna lain.',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    enabled: !awaitingCode,
                    decoration: const InputDecoration(
                      labelText: 'Nomor HP',
                      hintText: '0812xxxxxxx',
                      prefixIcon: Icon(Icons.phone_android_rounded),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (!awaitingCode)
                    FilledButton.tonal(
                      onPressed: state.busy
                          ? null
                          : () => ref
                              .read(authProvider.notifier)
                              .startPhoneVerification(_phoneController.text, link: false),
                      child: const Text('Kirim kode'),
                    )
                  else ...[
                    TextField(
                      controller: _codeController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Kode 6 digit',
                        prefixIcon: Icon(Icons.password_rounded),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: state.busy
                          ? null
                          : () => ref
                              .read(authProvider.notifier)
                              .submitSmsCode(_codeController.text, link: false),
                      child: const Text('Verifikasi & masuk'),
                    ),
                    TextButton(
                      onPressed: state.busy
                          ? null
                          : () {
                              _codeController.clear();
                              ref
                                  .read(authProvider.notifier)
                                  .startPhoneVerification(_phoneController.text, link: false);
                            },
                      child: const Text('Kirim ulang kode'),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Dengan masuk Anda menyetujui Syarat Layanan dan Kebijakan Privasi. '
            'Jelajahi tetap bisa dilakukan tanpa akun.',
            style: Theme.of(context).textTheme.labelSmall,
          ),
          if (state.busy) ...[
            const SizedBox(height: 16),
            const Center(child: CircularProgressIndicator()),
          ],
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.message,
    required this.color,
    required this.foreground,
  });

  final IconData icon;
  final String message;
  final Color color;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: foreground),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: foreground),
            ),
          ),
        ],
      ),
    );
  }
}
