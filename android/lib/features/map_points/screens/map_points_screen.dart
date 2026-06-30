import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../core/api_service.dart';

class MapPointsScreen extends StatefulWidget {
  const MapPointsScreen({super.key});

  @override
  State<MapPointsScreen> createState() => _MapPointsScreenState();
}

class _MapPointsScreenState extends State<MapPointsScreen> {
  final MapController _mapController = MapController();
  List<dynamic> _myPoints = [];
  bool _loading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadMyPoints();
  }

  Future<void> _loadMyPoints() async {
    try {
      final response = await apiService.get('/map-points/my-requests');
      setState(() {
        _myPoints = response['data'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'خطأ في تحميل النقاط: $e';
        _loading = false;
      });
    }
  }

  void _showAddPointDialog(LatLng point) {
    final nameController = TextEditingController();
    final noteController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('إضافة نقطة جديدة'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '📍 ${point.latitude.toStringAsFixed(5)}, ${point.longitude.toStringAsFixed(5)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'الاسم *',
                    hintText: 'مثال: بيت أبو أحمد',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteController,
                  decoration: const InputDecoration(
                    labelText: 'ملاحظة (اختياري)',
                    hintText: 'مثال: المنطقة ضعيفة',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 8),
                const Text(
                  '⏳ سيتم مراجعة الطلب من الإدارة',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('إلغاء'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('الاسم إلزامي')),
                  );
                  return;
                }
                try {
                  await apiService.post('/map-points', body: {
                    'name': nameController.text.trim(),
                    'note': noteController.text.trim().isEmpty ? null : noteController.text.trim(),
                    'location_lat': point.latitude,
                    'location_lng': point.longitude,
                  });
                  if (mounted) {
                    Navigator.pop(context);
                    _loadMyPoints();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('✅ تم إرسال الطلب بنجاح')),
                    );
                  }
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('❌ خطأ: $e')),
                  );
                }
              },
              child: const Text('إرسال'),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    return switch (status) {
      'approved' => Colors.green,
      'pending' => Colors.orange,
      'rejected' => Colors.red,
      _ => Colors.grey,
    };
  }

  String _getStatusText(String status) {
    return switch (status) {
      'approved' => '✅ معتمد',
      'pending' => '⏳ بانتظار الموافقة',
      'rejected' => '❌ مرفوض',
      _ => status,
    };
  }

  Future<void> _goToCurrentLocation() async {
    final status = await Permission.location.request();
    if (!status.isGranted) {
      setState(() => _errorMessage = 'يجب السماح بالوصول للموقع');
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition();
      _mapController.move(
        LatLng(position.latitude, position.longitude),
        17,
      );
    } catch (e) {
      setState(() => _errorMessage = 'خطأ في تحديد الموقع: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('نقاطي'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadMyPoints,
          ),
        ],
      ),
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
          Expanded(
            flex: 2,
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: const LatLng(24.7136, 46.6753),
                initialZoom: 15,
                onLongPress: (tapPosition, point) => _showAddPointDialog(point),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.wifi.network.app',
                ),
                MarkerLayer(
                  markers: _myPoints.where((p) => p['status'] == 'approved').map((p) {
                    return Marker(
                      point: LatLng(p['location_lat'], p['location_lng']),
                      width: 40,
                      height: 40,
                      child: const Icon(Icons.location_on, color: Colors.red, size: 40),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 1,
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _myPoints.isEmpty
                    ? const Center(child: Text('لا توجد نقاط'))
                    : ListView.builder(
                        itemCount: _myPoints.length,
                        itemBuilder: (context, index) {
                          final point = _myPoints[index];
                          return ListTile(
                            leading: Icon(
                              Icons.location_on,
                              color: _getStatusColor(point['status']),
                            ),
                            title: Text(point['name']),
                            subtitle: Text(_getStatusText(point['status'])),
                            trailing: Text(
                              point['created_at']?.toString().substring(0, 10) ?? '',
                              style: const TextStyle(fontSize: 12),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _goToCurrentLocation,
        child: const Icon(Icons.my_location),
      ),
    );
  }
}
