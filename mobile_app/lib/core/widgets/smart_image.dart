import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

/// Renders remote images, local `data:` previews from the image picker, and a
/// stable branded fallback when a listing has no photo (information posts).
class SmartImage extends StatelessWidget {
  const SmartImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.icon = Icons.image_outlined,
    this.borderRadius,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final IconData icon;
  final BorderRadius? borderRadius;

  Uint8List? _decode(String value) {
    try {
      final comma = value.indexOf(',');
      if (comma == -1) return null;
      return base64Decode(value.substring(comma + 1));
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = _buildContent(context);
    if (borderRadius == null) return child;
    return ClipRRect(borderRadius: borderRadius!, child: child);
  }

  Widget _buildContent(BuildContext context) {
    final value = url;
    if (value == null || value.isEmpty) {
      return _Fallback(width: width, height: height, icon: icon);
    }
    if (value.startsWith('data:')) {
      final bytes = _decode(value);
      if (bytes == null) {
        return _Fallback(width: width, height: height, icon: icon);
      }
      return Image.memory(
        bytes,
        fit: fit,
        width: width,
        height: height,
        errorBuilder: (_, _, _) =>
            _Fallback(width: width, height: height, icon: icon),
      );
    }
    return CachedNetworkImage(
      imageUrl: value,
      fit: fit,
      width: width,
      height: height,
      fadeInDuration: const Duration(milliseconds: 180),
      placeholder: (_, _) => Container(
        width: width,
        height: height,
        color: AppPalette.of(context).chipBackground,
      ),
      errorWidget: (_, _, _) =>
          _Fallback(width: width, height: height, icon: icon),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({this.width, this.height, required this.icon});

  final double? width;
  final double? height;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            palette.chipBackground,
            Color.alphaBlend(
              Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
              palette.chipBackground,
            ),
          ],
        ),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: palette.subtleText, size: 30),
    );
  }
}
