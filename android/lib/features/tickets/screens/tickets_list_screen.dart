import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api_service.dart';
import '../../../shared/widgets/loading_widget.dart';
import '../../../shared/widgets/error_widget.dart';

class TicketsListScreen extends StatefulWidget {
  const TicketsListScreen({super.key});

  @override
  State<TicketsListScreen> createState() => _TicketsListScreenState();
}

class _TicketsListScreenState extends State<TicketsListScreen> {
  List<dynamic> _tickets = [];
  bool _loading = true;
  String? _error;
  bool _isTechnician = false;
  int? _claimingId;

  @override
  void initState() {
    super.initState();
    _loadTickets();
    _detectRole();
  }

  Future<void> _loadTickets() async {
    try {
      final response = await apiService.get('/tickets');
      // BUGFIX: GET /tickets يعيد { items, pagination } وليس مصفوفة مباشرة —
      // الكود السابق كان يضع الكائن كاملاً فتظهر بطاقات فاسدة بدل البلاغات
      final data = response['data'];
      setState(() {
        _tickets = data is List ? data : (data is Map ? (data['items'] ?? []) : []);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // FEATURE: تبنّي البلاغ — نستنتج دور المستخدم من حمّلة التوكن (بدون حزم خارجية)
  Future<void> _detectRole() async {
    try {
      final token = await apiService.getToken();
      if (token == null) return;
      final parts = token.split('.');
      if (parts.length != 3) return;
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final data = jsonDecode(payload);
      if (mounted && data is Map && data['role'] == 'technician') {
        setState(() => _isTechnician = true);
      }
    } catch (_) {
      // توكن غير قابل للفك — يبقى زر التبني مخفياً، والخادم هو حارس الصلاحيات النهائي
    }
  }

  Future<void> _claimTicket(int id) async {
    setState(() => _claimingId = id);
    try {
      await apiService.post('/tickets/$id/claim');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تم تبنّي البلاغ — أصبح معيَّناً لك'), backgroundColor: Colors.green),
        );
      }
      await _loadTickets();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
      await _loadTickets();
    } finally {
      if (mounted) setState(() => _claimingId = null);
    }
  }

  Color _getStatusColor(String status) {
    return switch (status) {
      'pending' => Colors.orange,
      'assigned' => Colors.blue,
      'in_progress' => Colors.purple,
      'completed' => Colors.green,
      _ => Colors.grey,
    };
  }

  String _getStatusText(String status) {
    return switch (status) {
      'pending' => 'قيد الانتظار',
      'assigned' => 'معين',
      'in_progress' => 'قيد التنفيذ',
      'completed' => 'مكتمل',
      _ => status,
    };
  }

  String _getPriorityText(String priority) {
    return switch (priority) {
      'low' => 'منخفض',
      'medium' => 'متوسط',
      'high' => 'عالي',
      'urgent' => 'عاجل',
      _ => priority,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingWidget(message: 'جاري تحميل البلاغات...');
    if (_error != null) return AppErrorWidget(message: _error!, onRetry: _loadTickets);

    return RefreshIndicator(
      onRefresh: _loadTickets,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _tickets.length,
        itemBuilder: (context, index) {
          final ticket = _tickets[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              onTap: () => context.push('/tickets/${ticket['id']}'),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _getStatusColor(ticket['status']),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _getStatusText(ticket['status']),
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _getPriorityText(ticket['priority']),
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      ticket['title'] ?? '',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.person, size: 16, color: Colors.grey),
                        const SizedBox(width: 4),
                        Text(ticket['customer_name'] ?? ''),
                        const Spacer(),
                        if (ticket['technician_name'] != null) ...[
                          const Icon(Icons.engineering, size: 16, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text(ticket['technician_name']),
                        ],
                      ],
                    ),
                    // FEATURE: تبنّي البلاغ — زر حجز البلاغ المتاح للفني
                    if (_isTechnician && ticket['status'] == 'pending' && ticket['assigned_to'] == null) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: _claimingId == ticket['id']
                            ? const Center(
                                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                              )
                            : ElevatedButton.icon(
                                onPressed: () => _claimTicket(ticket['id']),
                                icon: const Icon(Icons.volunteer_activism, size: 18),
                                label: const Text('تبنّي البلاغ'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.amber.shade600,
                                  foregroundColor: Colors.white,
                                ),
                              ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
