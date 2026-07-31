import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import 'api_endpoints.dart';

part 'auth_api.g.dart';

/// Retrofit declaration of F-01/F-02 endpoints. Methods return the raw
/// envelope (`HttpResponse<dynamic>`); AuthRepositoryImpl unwraps `data`
/// once instead of generic-envelope retrofit/json_serializable boilerplate.
@RestApi()
abstract class AuthApi {
  factory AuthApi(Dio dio, {String baseUrl}) = _AuthApi;

  @POST(ApiEndpoints.login)
  Future<HttpResponse<dynamic>> login(@Body() Map<String, dynamic> body);

  @POST(ApiEndpoints.activate)
  Future<HttpResponse<dynamic>> activate(@Body() Map<String, dynamic> body);

  @POST(ApiEndpoints.logout)
  Future<HttpResponse<dynamic>> logout(@Body() Map<String, dynamic> body);
}
