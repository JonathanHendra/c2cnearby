import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../data/models/auth_models.dart';
import '../config/app_config.dart';

class AuthApiException implements Exception {
  const AuthApiException(
    this.code,
    this.message, {
    this.statusCode,
    this.requiredStep,
  });

  final String code;
  final String message;
  final int? statusCode;
  final String? requiredStep;

  @override
  String toString() => 'AuthApiException($code): $message';
}

/// Thin client for the FASE 3 auth/profile endpoints.
///
/// Firebase remains the only source of tokens; nothing secret is cached here.
/// A 401 triggers exactly one forced refresh, then the error is surfaced.
class AuthApi {
  AuthApi({Dio? dio, FirebaseAuth? firebaseAuth})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: AppConfig.apiBaseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 30),
                headers: const {'Accept': 'application/json'},
              ),
            ),
        _authOverride = firebaseAuth;

  final Dio _dio;
  final FirebaseAuth? _authOverride;

  /// Firebase can be unavailable on builds without native config; the UI then
  /// stays in browse-only mode instead of crashing when this is read.
  FirebaseAuth? get _auth {
    if (_authOverride != null) {
      return _authOverride;
    }
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  Future<ProfileSnapshot> createSession() async {
    final data = await _send((token) => _dio.post<dynamic>(
          '/auth/session',
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    return _snapshot(data);
  }

  Future<ProfileSnapshot> fetchMe() async {
    final data = await _send((token) => _dio.get<dynamic>(
          '/me',
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    return _snapshot(data);
  }

  Future<ProfileSnapshot> updateProfile({
    String? displayName,
    String? fullName,
    String? bio,
    String? areaLabel,
  }) async {
    final body = <String, dynamic>{
      'display_name': ?displayName,
      'full_name': ?fullName,
      'bio': ?bio,
      'area_label': ?areaLabel,
    };
    final data = await _send((token) => _dio.patch<dynamic>(
          '/me',
          data: body,
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    return _snapshot(data);
  }

  Future<ProfileSnapshot> claimUsername(String username) async {
    final data = await _send((token) => _dio.patch<dynamic>(
          '/me/username',
          data: {'username': username},
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    return _snapshot(data);
  }

  /// Sends the freshly minted Firebase token that carries the verified number.
  Future<ProfileSnapshot> verifyPhone() async {
    final data = await _send((token) => _dio.post<dynamic>(
          '/me/phone/verify',
          data: const <String, dynamic>{},
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    return _snapshot(data);
  }

  Future<ProfileSnapshot> saveLocation({
    required double lat,
    required double lng,
    String? areaLabel,
  }) async {
    final data = await _send((token) => _dio.put<dynamic>(
          '/me/location',
          data: {
            'lat': lat,
            'lng': lng,
            'area_label': ?areaLabel,
          },
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    return _snapshot(data);
  }

  Future<FaceSessionInfo> createFaceSession() async {
    final data = await _send((token) => _dio.post<dynamic>(
          '/me/verification/face/session',
          data: const {'consent': true},
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    final session = (data['session'] as Map<String, dynamic>?) ?? const {};
    return FaceSessionInfo.fromJson(session);
  }

  Future<String> uploadAvatar(File file) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path),
    });
    final data = await _send((token) => _dio.post<dynamic>(
          '/me/avatar',
          data: form,
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    final image = (data['image'] as Map<String, dynamic>?) ?? const {};
    return image['url'] as String? ?? '';
  }

  Future<DateTime> requestDeletion() async {
    final data = await _send((token) => _dio.delete<dynamic>(
          '/me',
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ));
    final raw = data['purge_after'] as String?;
    return DateTime.tryParse(raw ?? '')?.toLocal() ?? DateTime.now();
  }

  ProfileSnapshot _snapshot(Map<String, dynamic> data) {
    if (data['user'] is Map<String, dynamic>) {
      return ProfileSnapshot.fromJson(data);
    }
    final nested = data['data'];
    if (nested is Map<String, dynamic>) {
      return ProfileSnapshot.fromJson(nested);
    }
    throw const AuthApiException('INVALID_RESPONSE', 'Respons server tidak dikenali.');
  }

  Future<Map<String, dynamic>> _send(
    Future<Response<dynamic>> Function(String token) request,
  ) async {
    final user = _auth?.currentUser;
    if (user == null) {
      throw const AuthApiException('NOT_SIGNED_IN', 'Anda belum masuk.');
    }

    final token = await user.getIdToken();
    if (token == null) {
      throw const AuthApiException('NO_TOKEN', 'Token sesi tidak tersedia.');
    }

    try {
      return _data(await request(token));
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        final refreshed = await user.getIdToken(true);
        if (refreshed != null) {
          try {
            return _data(await request(refreshed));
          } on DioException catch (retryError) {
            throw _mapError(retryError);
          }
        }
      }
      throw _mapError(error);
    }
  }

  Map<String, dynamic> _data(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
      return body;
    }
    return const <String, dynamic>{};
  }

  AuthApiException _mapError(DioException error) {
    final body = error.response?.data;
    if (body is Map<String, dynamic>) {
      final envelope = body['error'];
      if (envelope is Map<String, dynamic>) {
        final details = envelope['details'];
        final requiredStep = details is Map<String, dynamic>
            ? details['required_step'] as String?
            : null;
        return AuthApiException(
          envelope['code'] as String? ?? 'REQUEST_FAILED',
          envelope['message'] as String? ?? 'Permintaan gagal.',
          statusCode: error.response?.statusCode,
          requiredStep: requiredStep,
        );
      }
    }

    return AuthApiException(
      'NETWORK_ERROR',
      'Tidak dapat menghubungi server. Periksa koneksi Anda.',
      statusCode: error.response?.statusCode,
    );
  }
}
