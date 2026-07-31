/// Decoded from the access token's JWT claims (`user_id`, `role` — see
/// backend/internal/common/constants.go JWTClaimUserID/JWTClaimRole). Used
/// only for client-side UI gating; the server independently re-validates
/// every request.
class UserSession {
  const UserSession({required this.userId, required this.role});

  final String userId;
  final String role;

  bool get isAdmin => role == 'admin';
}

class TokenPair {
  const TokenPair({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}
