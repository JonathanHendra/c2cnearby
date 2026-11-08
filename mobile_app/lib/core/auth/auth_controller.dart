import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../data/models/auth_models.dart';
import '../config/app_config.dart';
import 'auth_api.dart';

enum AuthStatus { initializing, signedOut, signedIn }

class AuthState {
  const AuthState({
    this.status = AuthStatus.initializing,
    this.user,
    this.onboarding,
    this.busy = false,
    this.error,
    this.notice,
    this.phoneVerificationId,
  });

  final AuthStatus status;
  final AuthUser? user;
  final Onboarding? onboarding;
  final bool busy;
  final String? error;
  final String? notice;
  final String? phoneVerificationId;

  bool get isSignedIn => status == AuthStatus.signedIn && user != null;
  bool get onboardingComplete => onboarding?.isComplete ?? false;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    Onboarding? onboarding,
    bool? busy,
    String? error,
    String? notice,
    String? phoneVerificationId,
    bool clearError = false,
    bool clearNotice = false,
    bool clearPhone = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      onboarding: onboarding ?? this.onboarding,
      busy: busy ?? this.busy,
      error: clearError ? null : (error ?? this.error),
      notice: clearNotice ? null : (notice ?? this.notice),
      phoneVerificationId:
          clearPhone ? null : (phoneVerificationId ?? this.phoneVerificationId),
    );
  }
}

/// Owns the Firebase session and the mirrored backend profile.
///
/// Only Firebase persists credentials; this controller keeps the server profile
/// in memory and never writes tokens to shared preferences.
class AuthController extends StateNotifier<AuthState> {
  AuthController(this._api, {this.googleEnabled = true}) : super(const AuthState()) {
    initialize();
  }

  final AuthApi _api;
  final bool googleEnabled;

  bool _googleInitialized = false;

  Future<void> initialize() async {
    if (Firebase.apps.isEmpty) {
      state = const AuthState(
        status: AuthStatus.signedOut,
        notice: 'Firebase belum dikonfigurasi pada build ini. Masuk dinonaktifkan.',
      );
      return;
    }

    final current = FirebaseAuth.instance.currentUser;
    if (current == null) {
      state = const AuthState(status: AuthStatus.signedOut);
      return;
    }

    await _loadSession();
  }

  Future<void> _loadSession({bool create = true}) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final snapshot = create ? await _api.createSession() : await _api.fetchMe();
      state = AuthState(
        status: AuthStatus.signedIn,
        user: snapshot.user,
        onboarding: snapshot.onboarding,
      );
    } on AuthApiException catch (error) {
      if (error.statusCode == 401) {
        await FirebaseAuth.instance.signOut();
        state = AuthState(status: AuthStatus.signedOut, error: error.message);
        return;
      }
      state = state.copyWith(busy: false, error: error.message);
    } catch (_) {
      state = state.copyWith(
        busy: false,
        error: 'Tidak dapat memuat profil. Periksa koneksi lalu coba lagi.',
      );
    }
  }

  Future<void> refresh() => _loadSession(create: false);

  Future<void> signInWithGoogle() async {
    state = state.copyWith(busy: true, clearError: true, clearNotice: true);

    if (!googleEnabled || !AppConfig.isGoogleConfigured) {
      state = state.copyWith(
        busy: false,
        error: 'GOOGLE_SERVER_CLIENT_ID belum diisi pada build. '
            'Tambahkan --dart-define=GOOGLE_SERVER_CLIENT_ID=... lalu build ulang.',
      );
      return;
    }

    try {
      final google = GoogleSignIn.instance;
      if (!_googleInitialized) {
        await google.initialize(serverClientId: AppConfig.googleServerClientId);
        _googleInitialized = true;
      }

      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        state = state.copyWith(
          busy: false,
          error: 'Google tidak mengembalikan idToken. Periksa konfigurasi OAuth.',
        );
        return;
      }

      await FirebaseAuth.instance.signInWithCredential(
        GoogleAuthProvider.credential(idToken: idToken),
      );
      await _loadSession();
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        state = state.copyWith(busy: false);
        return;
      }
      state = state.copyWith(busy: false, error: _describeGoogleError(error));
    } on FirebaseAuthException catch (error) {
      state = state.copyWith(busy: false, error: _describeAuthError(error));
    } catch (_) {
      state = state.copyWith(busy: false, error: 'Masuk dengan Google gagal. Coba lagi.');
    }
  }

  /// Starts Firebase Phone Auth. With `link: true` the number is attached to the
  /// already signed-in account instead of replacing the session.
  Future<void> startPhoneVerification(String phone, {bool link = true}) async {
    state = state.copyWith(busy: true, clearError: true, clearPhone: true);

    if (Firebase.apps.isEmpty) {
      state = state.copyWith(busy: false, error: 'Firebase belum dikonfigurasi.');
      return;
    }

    final normalized = _normalizePhone(phone);
    if (normalized == null) {
      state = state.copyWith(
        busy: false,
        error: 'Nomor tidak valid. Gunakan format 08xx atau +628xx.',
      );
      return;
    }

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: normalized,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (credential) async {
          await _finishPhone(credential, link: link);
        },
        verificationFailed: (error) {
          state = state.copyWith(busy: false, error: _describeAuthError(error));
        },
        codeSent: (verificationId, _) {
          state = state.copyWith(busy: false, phoneVerificationId: verificationId);
        },
        codeAutoRetrievalTimeout: (_) {},
      );
    } on FirebaseAuthException catch (error) {
      state = state.copyWith(busy: false, error: _describeAuthError(error));
    }
  }

  Future<void> submitSmsCode(String code, {bool link = true}) async {
    final verificationId = state.phoneVerificationId;
    if (verificationId == null) {
      state = state.copyWith(error: 'Minta kode verifikasi terlebih dahulu.');
      return;
    }
    if (code.trim().length < 4) {
      state = state.copyWith(error: 'Kode verifikasi tidak valid.');
      return;
    }

    state = state.copyWith(busy: true, clearError: true);
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: code.trim(),
      );
      await _finishPhone(credential, link: link);
    } on FirebaseAuthException catch (error) {
      state = state.copyWith(busy: false, error: _describeAuthError(error));
    }
  }

  Future<void> _finishPhone(
    PhoneAuthCredential credential, {
    required bool link,
  }) async {
    try {
      final auth = FirebaseAuth.instance;
      final current = auth.currentUser;
      if (link && current != null) {
        await current.linkWithCredential(credential);
        await current.reload();
        await current.getIdToken(true);
        final snapshot = await _api.verifyPhone();
        state = AuthState(
          status: AuthStatus.signedIn,
          user: snapshot.user,
          onboarding: snapshot.onboarding,
        );
        return;
      }

      await auth.signInWithCredential(credential);
      await _loadSession();
    } on FirebaseAuthException catch (error) {
      state = state.copyWith(busy: false, error: _describeAuthError(error));
    } on AuthApiException catch (error) {
      state = state.copyWith(busy: false, error: error.message);
    }
  }

  Future<bool> saveProfile({
    required String displayName,
    required String areaLabel,
    String? bio,
  }) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final snapshot = await _api.updateProfile(
        displayName: displayName,
        areaLabel: areaLabel,
        bio: bio,
      );
      state = state.copyWith(
        busy: false,
        user: snapshot.user,
        onboarding: snapshot.onboarding,
      );
      return true;
    } on AuthApiException catch (error) {
      state = state.copyWith(busy: false, error: error.message);
      return false;
    }
  }

  Future<bool> claimUsername(String username) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final snapshot = await _api.claimUsername(username);
      state = state.copyWith(
        busy: false,
        user: snapshot.user,
        onboarding: snapshot.onboarding,
      );
      return true;
    } on AuthApiException catch (error) {
      state = state.copyWith(busy: false, error: error.message);
      return false;
    }
  }

  Future<FaceSessionInfo?> startFaceSession() async {
    state = state.copyWith(busy: true, clearError: true, clearNotice: true);
    try {
      final session = await _api.createFaceSession();
      await refresh();
      state = state.copyWith(busy: false, notice: session.notice);
      return session;
    } on AuthApiException catch (error) {
      state = state.copyWith(busy: false, error: error.message);
      return null;
    }
  }

  /// Requests the 30-day deletion grace period, then clears the local session.
  Future<DateTime?> requestAccountDeletion() async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final purgeAfter = await _api.requestDeletion();
      await signOut();
      return purgeAfter;
    } on AuthApiException catch (error) {
      state = state.copyWith(busy: false, error: error.message);
      return null;
    }
  }

  Future<void> signOut() async {
    try {
      if (Firebase.apps.isNotEmpty) {
        await GoogleSignIn.instance.signOut();
        await FirebaseAuth.instance.signOut();
      }
    } catch (_) {
      // Local session is cleared regardless.
    }
    state = const AuthState(status: AuthStatus.signedOut);
  }

  void clearError() => state = state.copyWith(clearError: true);

  static String? _normalizePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9+]'), '');
    final withoutPlus = digits.startsWith('+') ? digits.substring(1) : digits;
    final national = withoutPlus.startsWith('62')
        ? withoutPlus.substring(2)
        : withoutPlus.startsWith('0')
            ? withoutPlus.substring(1)
            : withoutPlus;
    if (!RegExp(r'^8[0-9]{7,12}$').hasMatch(national)) {
      return null;
    }
    return '+62$national';
  }

  String _describeAuthError(FirebaseAuthException error) {
    switch (error.code) {
      case 'invalid-phone-number':
        return 'Nomor telepon tidak valid.';
      case 'invalid-verification-code':
        return 'Kode verifikasi salah.';
      case 'too-many-requests':
        return 'Terlalu banyak percobaan. Coba lagi nanti.';
      case 'credential-already-in-use':
        return 'Nomor ini sudah terhubung ke akun lain.';
      case 'provider-already-linked':
        return 'Nomor sudah terhubung ke akun ini.';
      case 'network-request-failed':
        return 'Jaringan bermasalah. Periksa koneksi Anda.';
      default:
        return error.message ?? 'Verifikasi gagal (${error.code}).';
    }
  }

  String _describeGoogleError(GoogleSignInException error) =>
      error.description ?? 'Masuk dengan Google gagal.';
}
