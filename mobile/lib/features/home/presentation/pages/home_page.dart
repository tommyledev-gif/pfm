import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_paths.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Placeholder landing page for a logged-in `member`. Wallets/categories/
/// budgets/transactions (F-03..F-07) have no backend endpoints yet — this
/// page will grow into the real dashboard once those APIs exist.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PFM'),
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
      body: const Center(
        child: Text('Welcome — wallets, budgets, and transactions are coming soon.'),
      ),
    );
  }
}
