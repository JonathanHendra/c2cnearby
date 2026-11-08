import 'package:intl/intl.dart';

final _rupiah = NumberFormat.currency(
  locale: 'id_ID',
  symbol: 'Rp ',
  decimalDigits: 0,
);

String formatRupiah(int? amount) {
  if (amount == null) return '—';
  return _rupiah.format(amount);
}

String formatDistance(int meters) {
  if (meters <= 0) return 'Di sekitar Anda';
  if (meters < 1000) return '$meters m';
  final km = meters / 1000;
  return '${km.toStringAsFixed(km >= 10 ? 0 : 1).replaceAll('.', ',')} km';
}

String timeAgo(DateTime time) {
  final diff = DateTime.now().difference(time);
  if (diff.inMinutes < 1) return 'Baru saja';
  if (diff.inMinutes < 60) return '${diff.inMinutes} mnt lalu';
  if (diff.inHours < 24) return '${diff.inHours} jam lalu';
  if (diff.inDays < 7) return '${diff.inDays} hari lalu';
  if (diff.inDays < 30) return '${(diff.inDays / 7).floor()} mgg lalu';
  return '${(diff.inDays / 30).floor()} bln lalu';
}

const _weekdays = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

const _months = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

String _two(int value) => value.toString().padLeft(2, '0');

String formatFullDate(DateTime time) {
  final local = time.toLocal();
  return '${_weekdays[local.weekday - 1]}, ${local.day} ${_months[local.month - 1]} ${local.year}';
}

String formatShortDate(DateTime time) {
  final local = time.toLocal();
  return '${local.day} ${_months[local.month - 1].substring(0, 3)} ${local.year}';
}

String formatTime(DateTime time) {
  final local = time.toLocal();
  return '${_two(local.hour)}.${_two(local.minute)}';
}

String formatEventRange(DateTime start, DateTime? end) {
  final date = formatFullDate(start);
  if (end == null) return '$date · ${formatTime(start)}';
  final sameDay = start.toLocal().day == end.toLocal().day;
  if (sameDay) {
    return '$date · ${formatTime(start)}–${formatTime(end)}';
  }
  return '$date ${formatTime(start)} – ${formatShortDate(end)} ${formatTime(end)}';
}

String formatChatTime(DateTime time) {
  final diff = DateTime.now().difference(time);
  if (diff.inDays == 0) return formatTime(time);
  if (diff.inDays == 1) return 'Kemarin';
  return formatShortDate(time);
}

String compactCount(int value) {
  if (value < 1000) return '$value';
  final thousands = value / 1000;
  return '${thousands.toStringAsFixed(thousands >= 10 ? 0 : 1).replaceAll('.', ',')} rb';
}
