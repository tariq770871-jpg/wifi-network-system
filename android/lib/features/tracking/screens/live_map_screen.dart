import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../core/constants.dart';
import '../../../core/api_service.dart';

class LiveMapScreen extends StatefulWidget {
  const LiveMapScreen({super.key});

  @override
  State<LiveMapScreen> createState() => _LiveMapScreenState();
}

class _LiveMapScreenState extends State<LiveMapScreen> {
  final MapController _mapController = MapController();
  bool _isSatellite = true;
  Position? _currentPosition;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initLocation();
  }

  Future<void> _initLocation() async {
    // Request location permission
    final status = await Permission.location.request();
    if (!status.isGranted) {
      setState(() => _errorMessage = 'يجب السماح بالوصول للموقع');
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition();
      setState(() => _currentPosition = position);
      _mapController.move(
        LatLng(position.latitude, position.longitude),
        AppConstants.defaultZoom,
      );

      Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen(_onPositionUpdate);
    } catch (e) {
      setState(() => _errorMessage = 'خطأ في تحديد الموقع: $e');
    }
  }

  void _onPositionUpdate(Position position) {
    setState(() => _currentPosition = position);
    _sendLocation(position);
  }

  Future<void> _sendLocation(Position position) async {
    try {
      await apiService.post('/tracking/log', body: {
        'lat': position.latitude,
        'lng': position.longitude,
        'heading': position.heading,
        'speed': position.speed,
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _currentPosition != null
                  ? LatLng(_currentPosition!.latitude, _currentPosition!.longitude)
                  : const LatLng(24.7136, 46.6753),
              initialZoom: AppConstants.defaultZoom,
              minZoom: AppConstants.minZoom,
              maxZoom: AppConstants.maxZoom,
            ),
            children: [
              TileLayer(
                urlTemplate: _isSatellite
                    ? 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
                    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.wifi.network.app',
              ),
              if (_currentPosition != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                      width: 40,
                      height: 40,
                      child: const Icon(Icons.my_location, color: Colors.blue, size: 40),
                    ),
                  ],
                ),
            ],
          ),
          if (_errorMessage != null)
            Positioned(
              top: 80,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'layer',
            onPressed: () => setState(() => _isSatellite = !_isSatellite),
            child: Icon(_isSatellite ? Icons.map : Icons.satellite),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.small(
            heroTag: 'location',
            onPressed: _goToCurrentLocation,
            child: const Icon(Icons.my_location),
          ),
        ],
      ),
    );
  }

  void _goToCurrentLocation() {
    if (_currentPosition != null) {
      _mapController.move(
        LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
        AppConstants.defaultZoom,
      );
    }
  }
}
