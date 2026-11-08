import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/auth/auth_api.dart';
import '../../core/widgets/common_widgets.dart';

class EditProfilePage extends ConsumerStatefulWidget {
  const EditProfilePage({super.key});

  @override
  ConsumerState<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends ConsumerState<EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _bio = TextEditingController();
  final _area = TextEditingController();
  bool _seeded = false;
  bool _saving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_seeded) return;
    _seeded = true;
    final user = ref.read(authProvider).user;
    _name.text = user?.displayName ?? '';
    _username.text = user?.usernameChosen == true ? user!.username : '';
    _area.text = user?.areaLabel ?? '';
    _bio.text = user?.bio ?? '';
  }

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _bio.dispose();
    _area.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    if (!ref.read(authProvider).isSignedIn) {
      await _promptSignIn();
      return;
    }

    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 90,
    );
    if (picked == null) return;

    setState(() => _saving = true);
    try {
      await ref.read(authApiProvider).uploadAvatar(File(picked.path));
      await ref.read(authProvider.notifier).refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto profil diperbarui.')),
        );
      }
    } on AuthApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final auth = ref.read(authProvider);
    if (!auth.isSignedIn) {
      await _promptSignIn();
      return;
    }

    setState(() => _saving = true);
    final controller = ref.read(authProvider.notifier);
    final username = _username.text.trim().toLowerCase();

    if (username.isNotEmpty && username != auth.user?.username) {
      final claimed = await controller.claimUsername(username);
      if (!claimed && mounted) {
        setState(() => _saving = false);
        final message = ref.read(authProvider).error ?? 'Username tidak tersimpan.';
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
        return;
      }
    }

    final saved = await controller.saveProfile(
      displayName: _name.text.trim(),
      areaLabel: _area.text.trim(),
      bio: _bio.text.trim(),
    );

    if (!mounted) return;
    setState(() => _saving = false);
    if (saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil tersimpan.')),
      );
      context.pop();
    } else {
      final message = ref.read(authProvider).error ?? 'Profil gagal disimpan.';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _promptSignIn() async {
    final go = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Masuk untuk menyimpan'),
        content: const Text(
          'Perubahan profil disimpan ke server dan memerlukan akun. '
          'Jelajahi konten tetap bisa tanpa masuk.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Masuk'),
          ),
        ],
      ),
    );
    if (go == true && mounted) {
      context.push('/masuk');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final palette = AppPalette.of(context);
    final signedIn = ref.watch(authProvider).isSignedIn;

    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profil')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            Center(
              child: Stack(
                children: [
                  AppAvatar(
                    imageUrl: user.avatarUrl,
                    name: user.displayName,
                    size: 88,
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: _saving ? null : _pickAvatar,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Theme.of(context).colorScheme.surface,
                            width: 2,
                          ),
                        ),
                        child: const Icon(Icons.edit_rounded,
                            size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: signedIn ? palette.successBackground : palette.warningBackground,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    signedIn ? Icons.cloud_done_outlined : Icons.info_outline_rounded,
                    size: 17,
                    color: signedIn ? AppColors.success : AppColors.warning,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      signedIn
                          ? 'Perubahan disimpan ke profil server. Avatar diunggah '
                              'sebagai WebP 512 px.'
                          : 'Anda belum masuk. Data yang diubah belum akan '
                              'tersimpan ke server.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: signedIn ? AppColors.success : AppColors.warning,
                          ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Nama tampilan'),
              validator: (value) =>
                  (value?.trim().length ?? 0) < 3 ? 'Minimal 3 karakter.' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _username,
              decoration: const InputDecoration(
                labelText: 'Username',
                prefixText: '@',
                helperText: 'Huruf kecil, angka, atau garis bawah. 3–30 karakter.',
              ),
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.isEmpty) return null;
                if (!RegExp(r'^[a-z0-9_]{3,30}$').hasMatch(text)) {
                  return 'Gunakan 3–30 karakter: a-z, 0-9, garis bawah.';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _area,
              decoration: const InputDecoration(
                labelText: 'Area domisili',
                helperText: 'Hanya area umum yang ditampilkan ke pengguna lain.',
              ),
              validator: (value) =>
                  (value?.trim().isEmpty ?? true) ? 'Isi area domisili.' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _bio,
              maxLines: 3,
              maxLength: 160,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Bio singkat',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.lock_outline_rounded,
                    size: 15, color: palette.mutedText),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Nomor telepon dan lokasi presisi tidak dapat diedit di sini. '
                    'Verifikasi telepon di halaman onboarding.',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Menyimpan…' : 'Simpan perubahan'),
            ),
            if (signedIn) ...[
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => context.push('/onboarding'),
                child: const Text('Kelola verifikasi & onboarding'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
