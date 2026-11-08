import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// C2C Nearby design tokens.
///
/// Electric blue is the single accent, navy carries structure, off-white and
/// deep navy are the page canvases. Radii stay between 16 and 20 px.
abstract final class AppColors {
  static const electric = Color(0xFF1B5CFF);
  static const electricDark = Color(0xFF0F49D6);
  static const electricSoft = Color(0xFFE9EFFF);
  static const navy = Color(0xFF0B1F3A);
  static const navyMid = Color(0xFF15304F);
  static const offWhite = Color(0xFFF7F8FA);
  static const deepNavy = Color(0xFF060E1A);
  static const darkSurface = Color(0xFF0C1929);
  static const darkElevated = Color(0xFF13243A);
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFB45309);
  static const danger = Color(0xFFD92D20);
  static const star = Color(0xFFF5A524);
}

@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.mutedText,
    required this.subtleText,
    required this.border,
    required this.chipBackground,
    required this.elevated,
    required this.successBackground,
    required this.warningBackground,
    required this.dangerBackground,
    required this.heroGradient,
    required this.favorite,
  });

  final Color mutedText;
  final Color subtleText;
  final Color border;
  final Color chipBackground;
  final Color elevated;
  final Color successBackground;
  final Color warningBackground;
  final Color dangerBackground;
  final List<Color> heroGradient;
  final Color favorite;

  static AppPalette of(BuildContext context) =>
      Theme.of(context).extension<AppPalette>() ?? lightPalette;

  static const lightPalette = AppPalette(
    mutedText: Color(0xFF5B6B82),
    subtleText: Color(0xFF8794A7),
    border: Color(0xFFE4E9F1),
    chipBackground: Color(0xFFF0F3F8),
    elevated: Color(0xFFFFFFFF),
    successBackground: Color(0xFFE8F7EE),
    warningBackground: Color(0xFFFFF5E6),
    dangerBackground: Color(0xFFFDECEA),
    heroGradient: [Color(0xFF1B5CFF), Color(0xFF0B2B72)],
    favorite: Color(0xFFE5484D),
  );

  static const darkPalette = AppPalette(
    mutedText: Color(0xFFA4B3C8),
    subtleText: Color(0xFF7C8DA5),
    border: Color(0xFF21344D),
    chipBackground: Color(0xFF172A41),
    elevated: Color(0xFF13243A),
    successBackground: Color(0xFF10301F),
    warningBackground: Color(0xFF332310),
    dangerBackground: Color(0xFF3A1714),
    heroGradient: [Color(0xFF245FF5), Color(0xFF0A1D3D)],
    favorite: Color(0xFFFF6B6B),
  );

  @override
  AppPalette copyWith({
    Color? mutedText,
    Color? subtleText,
    Color? border,
    Color? chipBackground,
    Color? elevated,
    Color? successBackground,
    Color? warningBackground,
    Color? dangerBackground,
    List<Color>? heroGradient,
    Color? favorite,
  }) {
    return AppPalette(
      mutedText: mutedText ?? this.mutedText,
      subtleText: subtleText ?? this.subtleText,
      border: border ?? this.border,
      chipBackground: chipBackground ?? this.chipBackground,
      elevated: elevated ?? this.elevated,
      successBackground: successBackground ?? this.successBackground,
      warningBackground: warningBackground ?? this.warningBackground,
      dangerBackground: dangerBackground ?? this.dangerBackground,
      heroGradient: heroGradient ?? this.heroGradient,
      favorite: favorite ?? this.favorite,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      mutedText: Color.lerp(mutedText, other.mutedText, t)!,
      subtleText: Color.lerp(subtleText, other.subtleText, t)!,
      border: Color.lerp(border, other.border, t)!,
      chipBackground: Color.lerp(chipBackground, other.chipBackground, t)!,
      elevated: Color.lerp(elevated, other.elevated, t)!,
      successBackground: Color.lerp(successBackground, other.successBackground, t)!,
      warningBackground: Color.lerp(warningBackground, other.warningBackground, t)!,
      dangerBackground: Color.lerp(dangerBackground, other.dangerBackground, t)!,
      heroGradient: [
        Color.lerp(heroGradient.first, other.heroGradient.first, t)!,
        Color.lerp(heroGradient.last, other.heroGradient.last, t)!,
      ],
      favorite: Color.lerp(favorite, other.favorite, t)!,
    );
  }
}

abstract final class AppTheme {
  static const radiusSm = 12.0;
  static const radiusMd = 16.0;
  static const radiusLg = 20.0;
  static const pagePadding = 20.0;

  static ThemeData light() => _build(Brightness.light, AppPalette.lightPalette);

  static ThemeData dark() => _build(Brightness.dark, AppPalette.darkPalette);

  static ThemeData _build(Brightness brightness, AppPalette palette) {
    final isDark = brightness == Brightness.dark;
    final base = ColorScheme.fromSeed(
      seedColor: AppColors.electric,
      brightness: brightness,
    );
    final scheme = base.copyWith(
      primary: isDark ? const Color(0xFF5C86FF) : AppColors.electric,
      onPrimary: Colors.white,
      secondary: isDark ? const Color(0xFF9DB4D8) : AppColors.navy,
      onSecondary: Colors.white,
      surface: isDark ? AppColors.darkSurface : Colors.white,
      onSurface: isDark ? const Color(0xFFF2F5FA) : AppColors.navy,
      error: isDark ? const Color(0xFFFF7A70) : AppColors.danger,
    );

    final textTheme = _textTheme(scheme, palette);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      fontFamily: 'PlusJakartaSans',
      scaffoldBackgroundColor:
          isDark ? AppColors.deepNavy : AppColors.offWhite,
      textTheme: textTheme,
      extensions: [palette],
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? AppColors.deepNavy : AppColors.offWhite,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          side: BorderSide(color: palette.border),
        ),
      ),
      dividerTheme: DividerThemeData(color: palette.border, thickness: 1, space: 1),
      iconTheme: IconThemeData(color: scheme.onSurface, size: 22),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? AppColors.darkElevated : Colors.white,
        hintStyle: textTheme.bodyMedium?.copyWith(color: palette.subtleText),
        labelStyle: textTheme.bodyMedium?.copyWith(color: palette.mutedText),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: _border(palette.border),
        enabledBorder: _border(palette.border),
        focusedBorder: _border(scheme.primary, width: 1.6),
        errorBorder: _border(scheme.error),
        focusedErrorBorder: _border(scheme.error, width: 1.6),
        errorStyle: textTheme.bodySmall?.copyWith(color: scheme.error),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          side: BorderSide(color: palette.border),
          foregroundColor: scheme.onSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: scheme.primary,
          textStyle: textTheme.labelLarge,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: palette.chipBackground,
        side: BorderSide.none,
        labelStyle: textTheme.bodySmall,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(100),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        backgroundColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => textTheme.labelSmall?.copyWith(
            color: states.contains(WidgetState.selected)
                ? scheme.primary
                : palette.mutedText,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? AppColors.darkElevated : AppColors.navy,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        ),
        titleTextStyle: textTheme.titleLarge,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      progressIndicatorTheme:
          ProgressIndicatorThemeData(color: scheme.primary),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Colors.white : null,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? scheme.primary
              : palette.chipBackground,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: scheme.surface,
      ),
    );
  }

  static OutlineInputBorder _border(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  static TextTheme _textTheme(ColorScheme scheme, AppPalette palette) {
    final base = ThemeData(
      brightness: scheme.brightness,
      fontFamily: 'PlusJakartaSans',
    ).textTheme;
    return base
        .copyWith(
          displaySmall: base.displaySmall?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -1.2,
            height: 1.1,
          ),
          headlineMedium: base.headlineMedium?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.8,
            height: 1.15,
          ),
          headlineSmall: base.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.4,
            height: 1.2,
          ),
          titleLarge: base.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
            height: 1.25,
          ),
          titleMedium: base.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.1,
          ),
          titleSmall: base.titleSmall?.copyWith(fontWeight: FontWeight.w600),
          bodyLarge: base.bodyLarge?.copyWith(height: 1.55),
          bodyMedium: base.bodyMedium?.copyWith(height: 1.55),
          bodySmall: base.bodySmall?.copyWith(
            height: 1.45,
            color: palette.mutedText,
          ),
          labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          labelMedium: base.labelMedium?.copyWith(fontWeight: FontWeight.w600),
          labelSmall: base.labelSmall?.copyWith(
            fontWeight: FontWeight.w500,
            letterSpacing: 0.1,
          ),
        )
        .apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
  }
}
