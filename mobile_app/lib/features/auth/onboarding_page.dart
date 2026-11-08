import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../data/models/auth_models.dart';

const _stateLabels = <String, String>{
  'incomplete': 'Profil belum lengkap',
  'profile_completed': 'Profil lengkap · verifikasi telepon',
  'phone_verified': 'Telepon terverifikasi',
  'face_verification_pending': 'Verifikasi wajah diproses',
  'verified': 'Terverifikasi',
  'rejected': 'Verifikasi wajah ditolak',
};

class OnboardingPage extends ConsumerStatefulWidget {
  const OnboardingPage({super.key});

  @override
  ConsumerState<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends ConsumerState<OnboardingPage> {
  final _username = TextEditingController();
  final _displayName = TextEditingController();
  final _area = TextEditingController();
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _seeded = false;

  @override
  void dispose() {
    _username.dispose();
    _displayName.dispose();
    _area.dispose();
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  void _seed(AuthUser user) {
    if (_seeded) return;
    _seeded = true;
    if (user.usernameChosen) _username.text = user.username;
    _displayName.text = user.displayName ?? '';
    _area.text = user.areaLabel ?? '';
  }

  Future<void> _save() async {
    final controller = ref.read(authProvider.notifier);
    final current = ref.read(authProvider).user;
    final username = _username.text.trim().toLowerCase();

    if (username.isNotEmpty && username != current?.username) {
      final ok = await controller.claimUsername(username);
      if (!ok) return;
    }
    await controller.saveProfile(
      displayName: _displayName.text.trim(),
      areaLabel: _area.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);
    final user = state.user;
    if (user != null) {
      _seed(user);
    }
    final palette = AppPalette.of(context);
    final onboarding = state.onboarding;

    ref.listen(authProvider, (previous, next) {
      if (next.error != null && next.error != previous?.error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.error!)),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Lengkapi Profil')),
      body: user == null
          ? Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_outline_rounded, size: 40),
                  const SizedBox(height: 12),
                  const Text('Masuk terlebih dahulu untuk melengkapi profil.'),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    child: const Text('Kembali'),
                  ),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: palette.chipBackground,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_user_outlined, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _stateLabels[onboarding?.state] ?? 'Status tidak diketahui',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      if (state.busy)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Text('Profil publik', style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        TextField(
                          controller: _displayName,
                          textCapitalization: TextCapitalization.words,
                          maxLength: 100,
                          decoration: const InputDecoration(
                            labelText: 'Nama tampilan',
                            prefixIcon: Icon(Icons.person_outline_rounded),
                          ),
                        ),
                        TextField(
                          controller: _username,
                          maxLength: 30,
                          decoration: InputDecoration(
                            labelText: 'Username',
                            prefixIcon: const Icon(Icons.alternate_email_rounded),
                            helperText: user.usernameChosen
                                ? '@${user.username}'
                                : 'Belum dipilih — masih @${user.username}',
                          ),
                        ),
                        TextField(
                          controller: _area,
                          maxLength: 120,
                          decoration: const InputDecoration(
                            labelText: 'Area (kelurahan/kecamatan)',
                            prefixIcon: Icon(Icons.place_outlined),
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: state.busy ? null : _save,
                            child: const Text('Simpan profil'),
                          ),
                        ),
                        Text(
                          'Lokasi presisi tidak ditampilkan ke pengguna lain; hanya jarak & area kasar.',
                          style: Theme.of(context).textTheme.labelSmall,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text('Verifikasi telepon', style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: user.phoneVerified
                        ? Row(
                            children: [
                              const Icon(Icons.check_circle_rounded,
                                  color: AppColors.success, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Terverifikasi: ${user.phoneMasked ?? '•••'}',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              TextField(
                                controller: _phone,
                                keyboardType: TextInputType.phone,
                                enabled: state.phoneVerificationId == null,
                                decoration: const InputDecoration(
                                  labelText: 'Nomor HP',
                                  hintText: '0812xxxxxxx',
                                  prefixIcon: Icon(Icons.phone_android_rounded),
                                ),
                              ),
                              const SizedBox(height: 10),
                              if (state.phoneVerificationId == null)
                                FilledButton.tonal(
                                  onPressed: state.busy || !user.profileCompleted
                                      ? null
                                      : () => ref
                                          .read(authProvider.notifier)
                                          .startPhoneVerification(_phone.text),
                                  child: Text(
                                    user.profileCompleted
                                        ? 'Kirim kode verifikasi'
                                        : 'Lengkapi profil dahulu',
                                  ),
                                )
                              else ...[
                                TextField(
                                  controller: _code,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Kode 6 digit',
                                    prefixIcon: Icon(Icons.password_rounded),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                FilledButton(
                                  onPressed: state.busy
                                      ? null
                                      : () => ref
                                          .read(authProvider.notifier)
                                          .submitSmsCode(_code.text),
                                  child: const Text('Verifikasi nomor'),
                                ),
                              ],
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 18),
                Text('Verifikasi wajah', style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          switch (user.faceVerificationStatus) {
                            'verified' => 'Wajah terverifikasi.',
                            'pending' => 'Sesi verifikasi sedang diproses.',
                            'rejected' => 'Verifikasi ditolak. Anda dapat mencoba lagi.',
                            _ => 'Diperlukan untuk kategori bernilai tinggi.',
                          },
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 10),
                        FilledButton.tonal(
                          onPressed: state.busy || !user.phoneVerified
                              ? null
                              : () => ref.read(authProvider.notifier).startFaceSession(),
                          child: const Text('Mulai sesi verifikasi wajah'),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          state.notice ??
                              'Penyedia e-KYC produksi belum dipilih; pada pengembangan '
                                  'ini status tidak akan menjadi terverifikasi.',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                TextButton.icon(
                  onPressed: () => ref.read(authProvider.notifier).signOut(),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Keluar dari akun'),
                ),
              ],
            ),
    );
  }
}
