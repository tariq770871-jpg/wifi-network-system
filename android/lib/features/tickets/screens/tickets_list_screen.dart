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

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    try {
      final response = await apiService.get('/tickets');
      setState(() {
        _tickets = response['data'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
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
