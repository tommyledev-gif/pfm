/// Path constants for every endpoint the app calls. No handler code should
/// ever write a route string inline (CLAUDE.md "no magic values" rule).
class ApiEndpoints {
  const ApiEndpoints._();

  static const String login = '/auth/login';
  static const String activate = '/auth/activate';
  static const String logout = '/auth/logout';

  static const String inviteUser = '/admin/users/invite';
  static const String listUsers = '/admin/users';
}
