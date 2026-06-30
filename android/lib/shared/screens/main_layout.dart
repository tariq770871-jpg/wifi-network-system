import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api_service.dart';

class MainLayout extends StatefulWidget {
  final Widget child;
  const MainLayout({super.key, required this.child});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _selectedIndex = 0;

  final List<_NavItem> _items = [
    _NavItem(icon: Icons.assignment, label: 'البلاغات', path: '/tickets'),
    _NavItem(icon: Icons.map, label: 'الخريطة', path: '/map'),
    _NavItem(icon: Icons.wifi_tethering, label: 'المسح', path: '/scan'),
    _NavItem(icon: Icons.add_location, label: 'نقاطي', path: '/map-points'),
  ];

  Future<void> _logout() async {
    await apiService.clearToken();
    if (mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('إدارة شبكات WiFi'),
          actions: [
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'تسجيل الخروج',
              onPressed: _logout,
            ),
          ],
        ),
        body: widget.child,
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedIndex,
          onDestinationSelected: (index) {
            setState(() => _selectedIndex = index);
            context.go(_items[index].path);
          },
          destinations: _items.map((item) => NavigationDestination(
            icon: Icon(item.icon),
            label: item.label,
          )).toList(),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  final String path;
  _NavItem({required this.icon, required this.label, required this.path});
}
