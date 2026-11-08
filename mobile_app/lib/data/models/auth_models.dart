import 'package:flutter/foundation.dart';

DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;

String? _string(Object? value) => value is String && value.isNotEmpty ? value : null;

/// The authenticated profile exactly as the backend returns it.
@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.username,
    required this.displayName,
    required this.avatarUrl,
    required this.areaLabel,
    required this.bio,
    required this.phone,
    required this.phoneMasked,
    required this.phoneVerified,
    required this.faceVerificationStatus,
    required this.profileCompleted,
    required this.usernameChosen,
    required this.accountStatus,
    required this.joinedAt,
  });

  final String id;
  final String username;
  final String? displayName;
  final String? avatarUrl;
  final String? areaLabel;
  final String? bio;
  final String? phone;
  final String? phoneMasked;
  final bool phoneVerified;
  final String faceVerificationStatus;
  final bool profileCompleted;
  final bool usernameChosen;
  final String accountStatus;
  final DateTime? joinedAt;

  bool get faceVerified => faceVerificationStatus == 'verified';

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: _string(json['display_name']),
      avatarUrl: _string(json['avatar_url']),
      areaLabel: _string(json['area_label']),
      bio: _string(json['bio']),
      phone: _string(json['phone']),
      phoneMasked: _string(json['phone_masked']),
      phoneVerified: json['phone_verified'] == true,
      faceVerificationStatus: json['face_verification_status'] as String? ?? 'unverified',
      profileCompleted: json['profile_completed'] == true,
      usernameChosen: json['username_chosen'] == true,
      accountStatus: json['account_status'] as String? ?? 'active',
      joinedAt: _date(json['joined_at']),
    );
  }
}

/// Server-derived onboarding state; the client never decides which step is due.
@immutable
class Onboarding {
  const Onboarding({
    required this.state,
    required this.requiredStep,
    required this.canSell,
    required this.canChat,
  });

  final String state;
  final String? requiredStep;
  final bool canSell;
  final bool canChat;

  bool get isComplete => state == 'verified' || state == 'phone_verified';

  factory Onboarding.fromJson(Map<String, dynamic> json) {
    final capabilities =
        (json['capabilities'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    return Onboarding(
      state: json['state'] as String? ?? 'incomplete',
      requiredStep: _string(json['required_step']),
      canSell: capabilities['sell'] == true,
      canChat: capabilities['chat'] == true,
    );
  }
}

@immutable
class UserLocation {
  const UserLocation({required this.lat, required this.lng, this.areaLabel});

  final double lat;
  final double lng;
  final String? areaLabel;

  factory UserLocation.fromJson(Map<String, dynamic> json) {
    return UserLocation(
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      areaLabel: _string(json['area_label']),
    );
  }
}

@immutable
class ProfileSnapshot {
  const ProfileSnapshot({
    required this.user,
    required this.onboarding,
    this.location,
  });

  final AuthUser user;
  final Onboarding onboarding;
  final UserLocation? location;

  factory ProfileSnapshot.fromJson(Map<String, dynamic> json) {
    final locationJson = json['location'];
    return ProfileSnapshot(
      user: AuthUser.fromJson((json['user'] as Map<String, dynamic>?) ?? const {}),
      onboarding: Onboarding.fromJson(
        (json['onboarding'] as Map<String, dynamic>?) ?? const {},
      ),
      location: locationJson is Map<String, dynamic>
          ? UserLocation.fromJson(locationJson)
          : null,
    );
  }
}

@immutable
class FaceSessionInfo {
  const FaceSessionInfo({
    required this.id,
    required this.status,
    required this.development,
    this.notice,
  });

  final String id;
  final String status;
  final bool development;
  final String? notice;

  factory FaceSessionInfo.fromJson(Map<String, dynamic> json) {
    return FaceSessionInfo(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      development: json['development'] == true,
      notice: _string(json['notice']),
    );
  }
}
