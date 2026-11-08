import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _chatNotifications = true;
  bool _offerNotifications = true;
  bool _eventNotifications = true;
  bool _reviewNotifications = false;

  Future<void> _confirmDeletion() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hapus akun?'),
        content: const Text(
          'Permintaan penghapusan berlaku 30 hari. Masuk kembali sebelum masa itu '
          'berakhir akan membatalkan permintaan. Setelah masa tenggang, profil '
          'dianonimkan dan data privat dihapus.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Ajukan penghapusan'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final purgeAfter = await ref.read(authProvider.notifier).requestAccountDeletion();
    if (!mounted) return;
    if (purgeAfter != null) {
      await _showInfo(
        title: 'Permintaan dicatat',
        message: 'Akun akan dihapus setelah '
            '${purgeAfter.day}/${purgeAfter.month}/${purgeAfter.year}.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(themeModeProvider);
    final auth = ref.watch(authProvider);
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Pengaturan Akun')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Text('Tampilan', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Card(
            child: RadioGroup<ThemeMode>(
              groupValue: mode,
              onChanged: (value) {
                if (value != null) {
                  ref.read(themeModeProvider.notifier).setMode(value);
                }
              },
              child: Column(
                children: [
                  const RadioListTile<ThemeMode>(
                    value: ThemeMode.light,
                    title: Text('Terang'),
                    secondary: Icon(Icons.light_mode_outlined),
                  ),
                  Divider(height: 1, indent: 16, color: palette.border),
                  const RadioListTile<ThemeMode>(
                    value: ThemeMode.dark,
                    title: Text('Gelap'),
                    secondary: Icon(Icons.dark_mode_outlined),
                  ),
                  Divider(height: 1, indent: 16, color: palette.border),
                  const RadioListTile<ThemeMode>(
                    value: ThemeMode.system,
                    title: Text('Ikuti sistem'),
                    secondary: Icon(Icons.brightness_auto_outlined),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text('Notifikasi', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  value: _chatNotifications,
                  onChanged: (value) =>
                      setState(() => _chatNotifications = value),
                  title: const Text('Pesan baru'),
                  subtitle: const Text('Chat dan balasan dari pengguna lain'),
                ),
                _Divider(color: palette.border),
                SwitchListTile(
                  value: _offerNotifications,
                  onChanged: (value) =>
                      setState(() => _offerNotifications = value),
                  title: const Text('Penawaran harga'),
                  subtitle: const Text('Tawaran, counter offer, dan keputusan'),
                ),
                _Divider(color: palette.border),
                SwitchListTile(
                  value: _eventNotifications,
                  onChanged: (value) =>
                      setState(() => _eventNotifications = value),
                  title: const Text('Event di sekitar'),
                  subtitle: const Text('Pengingat event yang Anda tandai'),
                ),
                _Divider(color: palette.border),
                SwitchListTile(
                  value: _reviewNotifications,
                  onChanged: (value) =>
                      setState(() => _reviewNotifications = value),
                  title: const Text('Ulasan baru'),
                  subtitle: const Text('Ulasan setelah transaksi selesai'),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(
              'Preferensi tersimpan di perangkat ini. Sinkronisasi dengan server '
              'dan FCM aktif pada Fase 7.',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ),
          const SizedBox(height: 18),
          Text('Privasi & keamanan', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: const Text('Kebijakan Privasi'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push('/profil/privasi'),
                ),
                _Divider(color: palette.border),
                ListTile(
                  leading: const Icon(Icons.data_usage_outlined),
                  title: const Text('Data dan retensi'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push('/profil/privasi'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text('Akun', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                if (!auth.isSignedIn)
                  ListTile(
                    leading: const Icon(Icons.login_rounded),
                    title: const Text('Masuk ke akun'),
                    subtitle: const Text('Google atau nomor telepon'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/masuk'),
                  )
                else ...[
                  ListTile(
                    leading: const Icon(Icons.badge_outlined),
                    title: Text('@${auth.user!.username}'),
                    subtitle: Text(
                      auth.user!.phoneVerified
                          ? 'Telepon terverifikasi'
                          : 'Verifikasi telepon belum selesai',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/onboarding'),
                  ),
                  _Divider(color: palette.border),
                  ListTile(
                    leading: const Icon(Icons.logout_rounded),
                    title: const Text('Keluar'),
                    onTap: () => ref.read(authProvider.notifier).signOut(),
                  ),
                ],
                _Divider(color: palette.border),
                ListTile(
                  leading: const Icon(Icons.delete_forever_outlined,
                      color: AppColors.danger),
                  title: const Text(
                    'Hapus akun',
                    style: TextStyle(color: AppColors.danger),
                  ),
                  enabled: auth.isSignedIn,
                  onTap: auth.isSignedIn ? _confirmDeletion : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Center(
            child: Text(
              'C2C Nearby 0.1.0 (1)',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showInfo({required String title, required String message}) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Divider(height: 1, indent: 16, color: color);
  }
}
