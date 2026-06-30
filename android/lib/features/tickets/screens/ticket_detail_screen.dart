import 'package:flutter/material.dart';

class TicketDetailScreen extends StatelessWidget {
  final String ticketId;
  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل البلاغ')),
      body: Center(child: Text('رقم البلاغ: $ticketId')),
    );
  }
}
