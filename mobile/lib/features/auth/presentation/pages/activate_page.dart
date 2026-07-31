import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/route_paths.dart';
import '../providers/auth_provider.dart';

/// Reached via the invite-email deep link `/activate?token=...`
/// (CLAUDE.md invite flow: admin invite -> email -> token -> user activate).
class ActivatePage extends ConsumerStatefulWidget {
  const ActivatePage({super.key, required this.token});

  final String token;

  @override
  ConsumerState<ActivatePage> createState() => _ActivatePageState();
}

class _ActivatePageState extends ConsumerState<ActivatePage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordConfirmController = TextEditingController();

  @override
  void dispose() {
    _fullNameController.dispose();
    _passwordController.dispose();
    _passwordConfirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isLoading = authState.isLoading;

    ref.listen(authProvider, (previous, next) {
      next.whenOrNull(
        data: (session) {
          if (session != null) {
            context.go(session.isAdmin ? RoutePaths.adminUsers : RoutePaths.home);
          }
        },
        error: (error, _) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(error.toString())),
          );
        },
      );
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Activate account')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Set your name and password to activate your account.'),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _fullNameController,
                    decoration: const InputDecoration(labelText: 'Full name (optional)'),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    decoration: const InputDecoration(labelText: 'Password'),
                    obscureText: true,
                    validator: (value) => (value == null || value.length < 8)
                        ? 'Password must be at least 8 characters'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordConfirmController,
                    decoration: const InputDecoration(labelText: 'Confirm password'),
                    obscureText: true,
                    validator: (value) => (value != _passwordController.text)
                        ? 'Passwords do not match'
                        : null,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: isLoading ? null : _submit,
                    child: isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Activate'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(authProvider.notifier).activate(
          token: widget.token,
          fullName: _fullNameController.text.trim(),
          password: _passwordController.text,
          passwordConfirm: _passwordConfirmController.text,
        );
  }
}
