import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_paths.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/admin_provider.dart';
import '../widgets/invite_user_dialog.dart';
import '../widgets/user_list_item.dart';

class UserListPage extends ConsumerWidget {
  const UserListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersState = ref.watch(adminUsersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Users'),
        actions: [
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go(RoutePaths.login);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showDialog<void>(
          context: context,
          builder: (_) => const InviteUserDialog(),
        ),
        child: const Icon(Icons.person_add),
      ),
      body: usersState.when(
        data: (state) => _UserList(users: state),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text(error.toString())),
      ),
    );
  }
}

class _UserList extends ConsumerWidget {
  const _UserList({required this.users});

  final AdminUsersState users;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (users.items.isEmpty) {
      return const Center(child: Text('No users yet'));
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(adminUsersProvider.notifier).refresh(),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: users.items.length + (users.hasMore ? 1 : 0),
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          if (index >= users.items.length) {
            ref.read(adminUsersProvider.notifier).loadMore();
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }
          return UserListItem(user: users.items[index]);
        },
      ),
    );
  }
}
