class AdminUser {
  const AdminUser({
    required this.id,
    required this.email,
    this.fullName,
    required this.status,
    required this.role,
    this.activatedAt,
    required this.createdAt,
  });

  final String id;
  final String email;
  final String? fullName;
  final String status;
  final String role;
  final DateTime? activatedAt;
  final DateTime createdAt;

  factory AdminUser.fromJson(Map<String, dynamic> json) => AdminUser(
        id: json['id'] as String,
        email: json['email'] as String,
        fullName: json['full_name'] as String?,
        status: json['status'] as String,
        role: json['role'] as String,
        activatedAt: json['activated_at'] == null
            ? null
            : DateTime.parse(json['activated_at'] as String),
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

class AdminUserPage {
  const AdminUserPage({
    required this.items,
    required this.nextCursor,
    required this.total,
  });

  final List<AdminUser> items;
  final String? nextCursor;
  final int total;
}
