import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/api_service.dart';

class HeatmapScreen extends StatefulWidget {
  const HeatmapScreen({super.key});

  @override
  State<HeatmapScreen> createState() => _HeatmapScreenState();
}

class _HeatmapScreenState extends State<HeatmapScreen> {
  List<dynamic> _readings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadReadings();
  }

  Future<void> _loadReadings() async {
    try {
      final response = await apiService.get('/tracking/signal');
      setState(() {
        _readings = response['data'] ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Color _getHeatColor(int dbm) {
    if (dbm > -50) return Colors.green;
    if (dbm > -70) return Colors.yellow;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('خريطة حرارية')),
      body: FlutterMap(
        options: const MapOptions(
          initialCenter: LatLng(24.7136, 46.6753),
          initialZoom: 15,
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            userAgentPackageName: 'com.wifi.network.app',
          ),
          CircleLayer(
            circles: _readings.map((r) {
              final dbm = r['signal_dbm'] ?? -100;
              return CircleMarker(
                point: LatLng(r['lat'], r['lng']),
                radius: 25,
                color: _getHeatColor(dbm).withOpacity(0.4),
                borderColor: _getHeatColor(dbm),
                borderStrokeWidth: 2,
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
