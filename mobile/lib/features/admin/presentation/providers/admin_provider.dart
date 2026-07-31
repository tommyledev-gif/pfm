import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/common/app_constants.dart';
import '../../data/admin_repository_impl.dart';
import '../../domain/admin_models.dart';
import '../../domain/admin_repository.dart';

part 'admin_provider.g.dart';

@riverpod
AdminRepository adminRepository(Ref ref) {
  return AdminRepositoryImpl(ref.watch(adminApiProvider));
}

class AdminUsersState {
  const AdminUsersState({
    required this.items,
    required this.nextCursor,
    required this.total,
  });

  final List<AdminUser> items;
  final String? nextCursor;
  final int total;

  bool get hasMore => nextCursor != null;
}

/// Owns the admin user list (F-01 US-03) and invite action (US-01).
/// Invite reloads the first page rather than hand-patching local state.
@riverpod
class AdminUsersNotifier extends _$AdminUsersNotifier {
  @override
  FutureOr<AdminUsersState> build() async {
    final page = await ref.watch(adminRepositoryProvider).listUsers(
          limit: AppConstants.defaultListLimit,
        );
    return AdminUsersState(
      items: page.items,
      nextCursor: page.nextCursor,
      total: page.total,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final page = await ref.read(adminRepositoryProvider).listUsers(
            limit: AppConstants.defaultListLimit,
          );
      return AdminUsersState(
        items: page.items,
        nextCursor: page.nextCursor,
        total: page.total,
      );
    });
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore) return;

    final page = await ref.read(adminRepositoryProvider).listUsers(
          cursor: current.nextCursor,
          limit: AppConstants.defaultListLimit,
        );
    state = AsyncData(
      AdminUsersState(
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
        total: page.total,
      ),
    );
  }

  Future<void> inviteUser({required String email, String? role}) async {
    await ref.read(adminRepositoryProvider).inviteUser(email: email, role: role);
    await refresh();
  }
}
