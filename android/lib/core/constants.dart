class AppConstants {
  // Cloud Backend - Render.com
  static const String apiBaseUrl = 'https://wifi-network-api.onrender.com/api';

  // Local storage keys
  static const String jwtKey = 'jwt_token';
  static const String userKey = 'user_data';

  // Map settings
  static const double defaultZoom = 15.0;
  static const double minZoom = 5.0;
  static const double maxZoom = 20.0;

  // Tracking interval (seconds)
  static const int trackingIntervalSeconds = 10;
  static const int signalScanIntervalSeconds = 10;

  // Tile cache
  static const String tileCacheStore = 'wifi_map_cache';
  static const Duration tileCacheDuration = Duration(days: 30);
}
