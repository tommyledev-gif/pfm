import 'package:flutter/material.dart';

import '../../domain/admin_models.dart';

class UserListItem extends StatelessWidget {
  const UserListItem({super.key, required this.user});

  final AdminUser user;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(child: Text(user.email.substring(0, 1).toUpperCase())),
      title: Text(user.fullName?.isNotEmpty == true ? user.fullName! : user.email),
      subtitle: Text(user.email),
      trailing: Wrap(
        spacing: 8,
        children: [
          Chip(label: Text(user.role)),
          Chip(label: Text(user.status)),
        ],
      ),
    );
  }
}
