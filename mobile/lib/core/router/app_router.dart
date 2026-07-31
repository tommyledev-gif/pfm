import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../features/admin/presentation/pages/user_list_page.dart';
import '../../features/auth/presentation/pages/activate_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/home/presentation/pages/home_page.dart';
import 'route_paths.dart';

part 'app_router.g.dart';

/// Guard: unauthenticated -> /login, authenticated hitting /login|/activate
/// -> their landing page, non-admin hitting /admin/users -> /. Rebuilds
/// whenever [authProvider] changes (login/logout/session-expiry).
@riverpod
GoRouter appRouter(Ref ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: RoutePaths.home,
    redirect: (context, state) {
      if (authState.isLoading) return null;

      final session = authState.value;
      final isAuthRoute = state.matchedLocation == RoutePaths.login ||
          state.matchedLocation == RoutePaths.activate;

      if (session == null) {
        return isAuthRoute ? null : RoutePaths.login;
      }

      if (isAuthRoute) {
        return session.isAdmin ? RoutePaths.adminUsers : RoutePaths.home;
      }

      if (state.matchedLocation == RoutePaths.adminUsers && !session.isAdmin) {
        return RoutePaths.home;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: RoutePaths.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: RoutePaths.activate,
        builder: (context, state) => ActivatePage(
          token: state.uri.queryParameters['token'] ?? '',
        ),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const HomePage(),
      ),
      GoRoute(
        path: RoutePaths.adminUsers,
        builder: (context, state) => const UserListPage(),
      ),
    ],
  );
}
