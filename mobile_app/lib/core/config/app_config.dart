/// Build-time configuration. Override with `--dart-define` when running.
///
/// The default points at the host machine from an Android emulator
/// (`10.0.2.2`); use `http://127.0.0.1:4000/api/v1` for a desktop/iOS
/// simulator or a LAN address for a physical device.
abstract final class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  /// Google OAuth web client id from Firebase Console. Required for Google
  /// Sign-In on Android to return an idToken; empty disables the button.
  static const googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );

  /// Discovery origin used for the 4 km feed until the member saves a location.
  /// Override per build: --dart-define=SEARCH_LAT=... --dart-define=SEARCH_LNG=...
  static const _searchLatRaw =
      String.fromEnvironment('SEARCH_LAT', defaultValue: '-6.4858');
  static const _searchLngRaw =
      String.fromEnvironment('SEARCH_LNG', defaultValue: '106.8504');

  static double get defaultSearchLat => double.tryParse(_searchLatRaw) ?? -6.4858;
  static double get defaultSearchLng => double.tryParse(_searchLngRaw) ?? 106.8504;

  static bool get isGoogleConfigured => googleServerClientId.isNotEmpty;
}
