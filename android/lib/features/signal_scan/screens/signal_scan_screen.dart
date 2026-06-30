import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:wifi_scan/wifi_scan.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../core/api_service.dart';
import '../../../core/constants.dart';

class SignalScanScreen extends StatefulWidget {
  const SignalScanScreen({super.key});

  @override
  State<SignalScanScreen> createState() => _SignalScanScreenState();
}

class _SignalScanScreenState extends State<SignalScanScreen> {
  bool _scanning = false;
  List<WiFiAccessPoint> _networks = [];
  Position? _position;
  String? _errorMessage;

  Future<bool> _requestPermissions() async {
    // Request location permission (required for WiFi scan on Android 12+)
    final locationStatus = await Permission.location.request();
    if (!locationStatus.isGranted) {
      setState(() => _errorMessage = 'يجب السماح بالوصول للموقع لمسح شبكات WiFi');
      return false;
    }

    // Request nearby WiFi devices permission (Android 12+)
    final nearbyWifiStatus = await Permission.nearbyWifiDevices.request();
    if (!nearbyWifiStatus.isGranted) {
      setState(() => _errorMessage = 'يجب السماح بالوصول لشبكات WiFi المجاورة');
      return false;
    }

    return true;
  }

  Future<void> _startScan() async {
    final hasPermission = await _requestPermissions();
    if (!hasPermission) return;

    setState(() {
      _scanning = true;
      _errorMessage = null;
    });

    try {
      final position = await Geolocator.getCurrentPosition();
      setState(() => _position = position);

      while (_scanning) {
        final result = await WiFiScan.instance.startScan(askPermissions: true);
        if (result == CanStartScan.yes) {
          final networks = await WiFiScan.instance.getScannedResults();
          setState(() => _networks = networks);

          for (final network in networks) {
            await apiService.post('/tracking/signal', body: {
              'lat': position.latitude,
              'lng': position.longitude,
              'signal_dbm': network.level,
              'ssid': network.ssid,
            });
          }
        }
        await Future.delayed(const Duration(seconds: 10));
      }
    } catch (e) {
      setState(() => _errorMessage = 'خطأ: $e');
    } finally {
      setState(() => _scanning = false);
    }
  }

  void _stopScan() => setState(() => _scanning = false);

  Color _getSignalColor(int level) {
    if (level > -50) return Colors.green;
    if (level > -70) return Colors.orange;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('مسح الإشارة')),
        body: Column(
          children: [
            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.red.shade50,
                child: Row(
                  children: [
                    const Icon(Icons.error, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red))),
                  ],
                ),
              ),
            if (_position != null)
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.blue.shade50,
                child: Row(
                  children: [
                    const Icon(Icons.location_on, color: Colors.blue),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'الموقع: ${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.grey.shade100,
              child: Row(
                children: [
                  Container(width: 12, height: 12, color: Colors.green),
                  const SizedBox(width: 4),
                  const Text('ممتاز', style: TextStyle(fontSize: 12)),
                  const SizedBox(width: 16),
                  Container(width: 12, height: 12, color: Colors.orange),
                  const SizedBox(width: 4),
                  const Text('متوسط', style: TextStyle(fontSize: 12)),
                  const SizedBox(width: 16),
                  Container(width: 12, height: 12, color: Colors.red),
                  const SizedBox(width: 4),
                  const Text('ضعيف', style: TextStyle(fontSize: 12)),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: _networks.length,
                itemBuilder: (context, index) {
                  final network = _networks[index];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: _getSignalColor(network.level),
                      child: const Icon(Icons.wifi, color: Colors.white, size: 20),
                    ),
                    title: Text(network.ssid ?? 'Unknown'),
                    subtitle: Text('${network.frequency} MHz'),
                    trailing: Text(
                      '${network.level} dBm',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: _getSignalColor(network.level),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _scanning ? _stopScan : _startScan,
          icon: Icon(_scanning ? Icons.stop : Icons.play_arrow),
          label: Text(_scanning ? 'إيقاف' : 'ابدأ الفحص'),
          backgroundColor: _scanning ? Colors.red : Colors.green,
        ),
      ),
    );
  }
}
