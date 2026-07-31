import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import 'api_endpoints.dart';

part 'admin_api.g.dart';

/// Thin retrofit declaration of F-01 admin endpoints — see auth_api.dart's
/// doc comment for why methods return the raw envelope instead of a typed
/// model.
@RestApi()
abstract class AdminApi {
  factory AdminApi(Dio dio, {String baseUrl}) = _AdminApi;

  @POST(ApiEndpoints.inviteUser)
  Future<HttpResponse<dynamic>> inviteUser(@Body() Map<String, dynamic> body);

  @GET(ApiEndpoints.listUsers)
  Future<HttpResponse<dynamic>> listUsers(@Queries() Map<String, dynamic> query);
}
