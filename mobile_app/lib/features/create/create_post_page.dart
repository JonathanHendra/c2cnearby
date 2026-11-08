import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/providers.dart';
import '../../app/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/smart_image.dart';
import '../../data/models/models.dart';
import '../../data/repositories/marketplace_repository.dart';

class CreatePostPage extends ConsumerStatefulWidget {
  const CreatePostPage({super.key});

  @override
  ConsumerState<CreatePostPage> createState() => _CreatePostPageState();
}

class _CreatePostPageState extends ConsumerState<CreatePostPage> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _price = TextEditingController();
  final _brand = TextEditingController();
  final _eventLocation = TextEditingController();
  final _link = TextEditingController();

  PostType _type = PostType.sell;
  String? _categorySlug;
  PriceType _priceType = PriceType.negotiable;
  ItemCondition _condition = ItemCondition.bekas;
  DateTime? _eventDate;
  TimeOfDay? _eventStart;
  TimeOfDay? _eventEnd;
  bool _eventIsFree = true;
  final List<String> _images = [];
  bool _submitting = false;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _price.dispose();
    _brand.dispose();
    _eventLocation.dispose();
    _link.dispose();
    super.dispose();
  }

  int get _maxImages => _type == PostType.sell ? 5 : 1;

  List<Category> get _categories =>
      (ref.watch(categoriesProvider).valueOrNull ?? const <Category>[])
          .where((item) => item.type == _type)
          .toList(growable: false);

  void _setType(PostType type) {
    setState(() {
      _type = type;
      _categorySlug = null;
      _images.clear();
      _link.clear();
    });
  }

  Future<void> _pickImage(ImageSource source) async {
    if (_images.length >= _maxImages) {
      _snack('Maksimal $_maxImages foto untuk jenis posting ini.');
      return;
    }
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 72,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (bytes.length > 5 * 1024 * 1024) {
        _snack('Ukuran foto terlalu besar. Pilih foto di bawah 5 MB.');
        return;
      }
      final mime = file.mimeType ?? 'image/jpeg';
      final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';
      if (!mounted) return;
      setState(() => _images.add(dataUrl));
    } catch (_) {
      if (!mounted) return;
      _snack(
        'Tidak dapat membuka ${source == ImageSource.camera ? "kamera" : "galeri"}. '
        'Periksa izin aplikasi lalu coba lagi.',
      );
    }
  }

  Future<void> _chooseImageSource() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Pilih dari galeri'),
              subtitle: const Text('Foto akan dikompres sebelum diunggah'),
              onTap: () {
                Navigator.of(context).pop();
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Ambil foto'),
              onTap: () {
                Navigator.of(context).pop();
                _pickImage(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final result = await showDatePicker(
      context: context,
      initialDate: _eventDate ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      helpText: 'Pilih tanggal event',
    );
    if (result != null) setState(() => _eventDate = result);
  }

  Future<void> _pickTime({required bool start}) async {
    final result = await showTimePicker(
      context: context,
      initialTime: start
          ? (_eventStart ?? const TimeOfDay(hour: 9, minute: 0))
          : (_eventEnd ?? const TimeOfDay(hour: 12, minute: 0)),
      helpText: start ? 'Waktu mulai' : 'Waktu selesai',
    );
    if (result == null) return;
    setState(() {
      if (start) {
        _eventStart = result;
      } else {
        _eventEnd = result;
      }
    });
  }

  DateTime? _combine(TimeOfDay? time) {
    if (_eventDate == null || time == null) return null;
    return DateTime(
      _eventDate!.year,
      _eventDate!.month,
      _eventDate!.day,
      time.hour,
      time.minute,
    );
  }

  Future<void> _submit({required bool asDraft}) async {
    FocusScope.of(context).unfocus();
    if (!asDraft && !(_formKey.currentState?.validate() ?? false)) {
      _snack('Periksa kembali data posting Anda.');
      return;
    }
    if (asDraft && _title.text.trim().length < 3) {
      _snack('Isi judul minimal 3 karakter untuk menyimpan draft.');
      return;
    }
    if (!asDraft && _type == PostType.event) {
      if (_eventDate == null || _eventStart == null) {
        _snack('Lengkapi tanggal dan waktu mulai event.');
        return;
      }
      if (_eventEnd != null && _eventStart != null) {
        final start = _combine(_eventStart)!;
        final end = _combine(_eventEnd)!;
        if (!end.isAfter(start)) {
          _snack('Waktu selesai harus setelah waktu mulai.');
          return;
        }
      }
    }
    if (!asDraft && _eventIsFree == false && _type == PostType.event) {
      final price = int.tryParse(_price.text.trim());
      if (price == null || price <= 0) {
        _snack('Isi harga tiket event.');
        return;
      }
    }

    final available = _categories;
    if (available.isEmpty) {
      _snack('Kategori belum tersedia. Muat ulang aplikasi lalu coba lagi.');
      return;
    }
    final category = available.firstWhere(
      (item) => item.slug == _categorySlug,
      orElse: () => available.first,
    );

    setState(() => _submitting = true);
    try {
      final draft = PostDraft(
        type: _type,
        title: _title.text.trim(),
        description: _description.text.trim(),
        categoryName: category.name,
        categorySlug: category.slug,
        price: _type == PostType.sell
            ? int.tryParse(_price.text.trim())
            : (_eventIsFree ? null : int.tryParse(_price.text.trim())),
        priceType: _type == PostType.sell ? _priceType : null,
        condition: _type == PostType.sell ? _condition : null,
        imageUrls: [..._images],
        eventStart: _type == PostType.event ? _combine(_eventStart) : null,
        eventEnd: _type == PostType.event ? _combine(_eventEnd) : null,
        eventLocation:
            _type == PostType.event ? _eventLocation.text.trim() : null,
        eventIsFree: _eventIsFree,
        informationLink:
            _type == PostType.information ? _link.text.trim() : null,
        brand: _type == PostType.sell ? _brand.text.trim() : null,
      );
      await ref
          .read(repositoryProvider)
          .createListing(draft, asDraft: asDraft);
      ref.invalidate(myListingsProvider);
      if (!mounted) return;
      _resetForm();
      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isDismissible: false,
        builder: (context) => Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  color: AppPalette.of(context).successBackground,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 32,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                asDraft ? 'Draft tersimpan' : 'Posting dipublikasikan',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              Text(
                asDraft
                    ? 'Anda dapat melanjutkan draft dari menu Posting Saya.'
                    : 'Posting Anda dapat dilihat warga dalam radius 4 km. '
                        'Foto akan diunggah ke object storage pada Fase 4; '
                        'pratinjau saat ini disimpan lokal di sesi ini.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    context.push('/profil/postingan');
                  },
                  child: const Text('Lihat Posting Saya'),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Tutup'),
              ),
            ],
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        _snack('Posting gagal disimpan. Coba lagi beberapa saat lagi.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _resetForm() {
    _formKey.currentState?.reset();
    _title.clear();
    _description.clear();
    _price.clear();
    _brand.clear();
    _eventLocation.clear();
    _link.clear();
    setState(() {
      _type = PostType.sell;
      _categorySlug = null;
      _images.clear();
      _eventDate = null;
      _eventStart = null;
      _eventEnd = null;
      _eventIsFree = true;
      _priceType = PriceType.negotiable;
      _condition = ItemCondition.bekas;
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Buat posting'),
            Text(
              'Jangkau warga dalam radius 4 km',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        toolbarHeight: 68,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 120),
          children: [
            Row(
              children: [
                for (final type in PostType.values) ...[
                  Expanded(
                    child: _TypeTile(
                      type: type,
                      selected: _type == type,
                      onTap: () => _setType(type),
                    ),
                  ),
                  if (type != PostType.values.last) const SizedBox(width: 8),
                ],
              ],
            ),
            const SizedBox(height: 22),
            Text(_titleForType(), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            _ImagePickerRow(
              images: _images,
              max: _maxImages,
              onAdd: _chooseImageSource,
              onRemove: (index) => setState(() => _images.removeAt(index)),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _title,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 150,
              decoration: InputDecoration(
                labelText: _type == PostType.sell
                    ? 'Judul barang'
                    : _type == PostType.event
                        ? 'Nama event'
                        : 'Judul informasi',
                hintText: _type == PostType.sell
                    ? 'Contoh: Sepatu lari ukuran 42'
                    : _type == PostType.event
                        ? 'Contoh: Pasar loak Minggu pagi'
                        : 'Contoh: Penutupan jalan Ampera',
                counterText: '',
              ),
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.length < 5) {
                  return 'Judul minimal 5 karakter.';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              key: ValueKey('category-${_type.value}'),
              initialValue: _categorySlug,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Kategori'),
              hint: const Text('Pilih kategori'),
              items: [
                for (final category in _categories)
                  DropdownMenuItem(value: category.slug, child: Text(category.name)),
              ],
              onChanged: (value) => setState(() => _categorySlug = value),
              validator: (value) =>
                  value == null ? 'Pilih kategori yang sesuai.' : null,
            ),
            const SizedBox(height: 14),
            if (_type == PostType.sell) ...[
              TextFormField(
                controller: _price,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Harga',
                  prefixText: 'Rp ',
                  hintText: '0',
                ),
                validator: (value) {
                  final price = int.tryParse(value ?? '');
                  if (price == null || price <= 0) {
                    return 'Masukkan harga lebih dari 0.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              _SegmentedChoice<PriceType>(
                label: 'Tipe harga',
                values: PriceType.values,
                selected: _priceType,
                labelOf: (value) => value.label,
                onChanged: (value) => setState(() => _priceType = value),
              ),
              const SizedBox(height: 12),
              _SegmentedChoice<ItemCondition>(
                label: 'Kondisi',
                values: ItemCondition.values,
                selected: _condition,
                labelOf: (value) => value.label,
                onChanged: (value) => setState(() => _condition = value),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _brand,
                decoration: const InputDecoration(
                  labelText: 'Brand / model (opsional)',
                  hintText: 'Contoh: Nike, Apple, IKEA',
                ),
              ),
              const SizedBox(height: 14),
            ],
            if (_type == PostType.event) ...[
              Row(
                children: [
                  Expanded(
                    child: _PickerTile(
                      icon: Icons.calendar_today_outlined,
                      label: 'Tanggal',
                      value: _eventDate == null
                          ? 'Pilih tanggal'
                          : formatShortDate(_eventDate!),
                      onTap: _pickDate,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _PickerTile(
                      icon: Icons.schedule_outlined,
                      label: 'Mulai',
                      value: _eventStart == null
                          ? 'Pilih waktu'
                          : _formatTimeOfDay(_eventStart!),
                      onTap: () => _pickTime(start: true),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _PickerTile(
                      icon: Icons.schedule_outlined,
                      label: 'Selesai',
                      value: _eventEnd == null
                          ? 'Opsional'
                          : _formatTimeOfDay(_eventEnd!),
                      onTap: () => _pickTime(start: false),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _eventLocation,
                decoration: const InputDecoration(
                  labelText: 'Lokasi publik event',
                  hintText: 'Contoh: Taman Kemang, dekat pintu barat',
                ),
                validator: (value) {
                  if ((value?.trim() ?? '').isEmpty) {
                    return 'Sebutkan lokasi publik event.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 6),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  'Event gratis',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                subtitle: Text(
                  'Platform tidak memproses pembayaran tiket.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                value: _eventIsFree,
                onChanged: (value) => setState(() => _eventIsFree = value),
              ),
              if (!_eventIsFree)
                TextFormField(
                  controller: _price,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(
                    labelText: 'Harga tiket',
                    prefixText: 'Rp ',
                  ),
                  validator: (value) {
                    final price = int.tryParse(value ?? '');
                    if (price == null || price <= 0) {
                      return 'Masukkan harga tiket.';
                    }
                    return null;
                  },
                ),
              const SizedBox(height: 14),
            ],
            TextFormField(
              controller: _description,
              maxLines: 5,
              minLines: 3,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: _type == PostType.information
                    ? 'Isi informasi'
                    : 'Deskripsi',
                alignLabelWithHint: true,
                hintText: _type == PostType.sell
                    ? 'Jelaskan kondisi, kelengkapan, dan alasan menjual.'
                    : 'Tuliskan detail yang membantu warga sekitar.',
                counterText: '',
              ),
              validator: (value) {
                if ((value?.trim().length ?? 0) < 20) {
                  return 'Tulis minimal 20 karakter agar informasinya jelas.';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            if (_type == PostType.information)
              TextFormField(
                controller: _link,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(
                  labelText: 'Tautan referensi (opsional)',
                  hintText: 'https://',
                ),
              ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: palette.chipBackground,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              ),
              child: Row(
                children: [
                  Icon(Icons.place_outlined,
                      size: 19, color: palette.mutedText),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Lokasi: ${ref.watch(currentUserProvider).areaLabel.isEmpty ? 'Belum diatur' : ref.watch(currentUserProvider).areaLabel}',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Koordinat presisi disimpan privat di server dan tidak pernah ditampilkan.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => _snack(
                      'Pemilih lokasi presisi tersedia pada Fase 4 setelah izin lokasi aktif.',
                    ),
                    child: const Text('Ubah'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Dengan mempublikasikan, Anda menyetujui aturan komunitas: tidak ada barang '
              'terlarang, penipuan, atau konten yang menyinggung warga sekitar.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _submitting ? null : () => _submit(asDraft: false),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : Text(_type == PostType.information
                      ? 'Publikasikan informasi'
                      : _type == PostType.event
                          ? 'Publikasikan event'
                          : 'Publikasikan barang'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _submitting ? null : () => _submit(asDraft: true),
              child: const Text('Simpan sebagai draft'),
            ),
          ],
        ),
      ),
    );
  }

  String _titleForType() => switch (_type) {
        PostType.sell => 'Detail barang',
        PostType.event => 'Detail event',
        PostType.information => 'Detail informasi',
      };

  String _formatTimeOfDay(TimeOfDay time) {
    final now = DateTime(2026, 1, 1, time.hour, time.minute);
    return formatTime(now);
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({
    required this.type,
    required this.selected,
    required this.onTap,
  });

  final PostType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final palette = AppPalette.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: selected
              ? Color.alphaBlend(
                  primary.withValues(alpha: 0.08),
                  Theme.of(context).colorScheme.surface,
                )
              : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: selected ? primary : palette.border,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              postTypeIcon(type),
              size: 21,
              color: selected ? primary : palette.mutedText,
            ),
            const SizedBox(height: 6),
            Text(
              type.label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected ? primary : palette.mutedText,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImagePickerRow extends StatelessWidget {
  const _ImagePickerRow({
    required this.images,
    required this.max,
    required this.onAdd,
    required this.onRemove,
  });

  final List<String> images;
  final int max;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return SizedBox(
      height: 92,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (var index = 0; index < images.length; index++) ...[
            Stack(
              children: [
                Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: palette.border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: SmartImage(url: images[index]),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: GestureDetector(
                    onTap: () => onRemove(index),
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded,
                          size: 14, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 8),
          ],
          if (images.length < max)
            GestureDetector(
              onTap: onAdd,
              child: Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  color: palette.chipBackground,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: palette.border),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_photo_alternate_outlined,
                        size: 22, color: palette.mutedText),
                    const SizedBox(height: 4),
                    Text(
                      '${images.length}/$max',
                      style: Theme.of(context).textTheme.labelSmall,
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

class _SegmentedChoice<T> extends StatelessWidget {
  const _SegmentedChoice({
    required this.label,
    required this.values,
    required this.selected,
    required this.labelOf,
    required this.onChanged,
  });

  final String label;
  final List<T> values;
  final T selected;
  final String Function(T value) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final palette = AppPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: palette.chipBackground,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              for (final value in values)
                Expanded(
                  child: GestureDetector(
                    onTap: () => onChanged(value),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: selected == value
                            ? Theme.of(context).colorScheme.surface
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Text(
                        labelOf(value),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: selected == value
                                  ? primary
                                  : palette.mutedText,
                              fontWeight: selected == value
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: palette.border),
          color: Theme.of(context).colorScheme.surface,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 15, color: palette.mutedText),
                const SizedBox(width: 5),
                Text(label, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ],
        ),
      ),
    );
  }
}
