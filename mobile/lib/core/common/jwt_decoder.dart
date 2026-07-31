import 'dart:convert';

/// Decodes a JWT payload WITHOUT verifying the signature — used only for
/// client-side UI gating. The server re-validates every request regardless.
class JwtDecoder {
  const JwtDecoder._();

  static Map<String, dynamic> decodePayload(String token) {
    final parts = token.split('.');
    if (parts.length != 3) {
      throw const FormatException('token does not have 3 segments');
    }
    final normalized = base64Url.normalize(parts[1]);
    final payload = utf8.decode(base64Url.decode(normalized));
    return jsonDecode(payload) as Map<String, dynamic>;
  }
}
