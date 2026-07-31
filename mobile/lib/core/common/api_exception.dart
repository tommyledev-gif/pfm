import 'package:dio/dio.dart';

/// Maps the backend's error envelope (`{success:false, error_code, message}`
/// — see backend/internal/response/response.go) to a typed exception so the
/// UI never has to poke around inside a raw DioException.
class ApiException implements Exception {
  const ApiException({required this.message, this.errorCode});

  final String message;
  final String? errorCode;

  factory ApiException.fromDioException(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      return ApiException(
        message: data['message'] as String? ?? 'an unexpected error occurred',
        errorCode: data['error_code'] as String?,
      );
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return const ApiException(message: 'could not reach the server');
    }
    return const ApiException(message: 'an unexpected error occurred');
  }

  @override
  String toString() => message;
}
