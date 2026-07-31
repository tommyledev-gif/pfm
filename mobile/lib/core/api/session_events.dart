import 'dart:async';

/// Fired on a 401 from an authenticated request. Plain stream, not a
/// Riverpod provider, so core/api never has to import features/auth.
final StreamController<void> sessionExpiredController =
    StreamController<void>.broadcast();
