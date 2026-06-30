import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/auth/screens/splash_screen.dart';
import '../features/tickets/screens/tickets_list_screen.dart';
import '../features/tickets/screens/ticket_detail_screen.dart';
import '../features/tracking/screens/live_map_screen.dart';
import '../features/map_points/screens/map_points_screen.dart';
import '../features/signal_scan/screens/signal_scan_screen.dart';
import '../features/signal_scan/screens/heatmap_screen.dart';
import '../shared/screens/main_layout.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    ShellRoute(
      builder: (context, state, child) => MainLayout(child: child),
      routes: [
        GoRoute(
          path: '/tickets',
          builder: (context, state) => const TicketsListScreen(),
        ),
        GoRoute(
          path: '/tickets/:id',
          builder: (context, state) => TicketDetailScreen(
            ticketId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/map',
          builder: (context, state) => const LiveMapScreen(),
        ),
        GoRoute(
          path: '/map-points',
          builder: (context, state) => const MapPointsScreen(),
        ),
        GoRoute(
          path: '/scan',
          builder: (context, state) => const SignalScanScreen(),
        ),
        GoRoute(
          path: '/heatmap',
          builder: (context, state) => const HeatmapScreen(),
        ),
      ],
    ),
  ],
);
