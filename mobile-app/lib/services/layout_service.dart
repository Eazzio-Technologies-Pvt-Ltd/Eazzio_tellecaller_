import 'package:flutter/material.dart';

/// Service to handle responsive styling and media-query scaling
/// for mobile viewports ranging from 380px to 450px wide.
class ResponsiveLayout {
  final BuildContext context;
  late final double screenWidth;
  late final double screenHeight;

  ResponsiveLayout(this.context) {
    final size = MediaQuery.of(context).size;
    screenWidth = size.width;
    screenHeight = size.height;
  }

  /// Scales a value linearly based on screen width from 380px to 450px.
  /// If the screen is narrower than 380px, it returns [minVal].
  /// If the screen is wider than 450px, it returns [maxVal].
  double scale(double minVal, double maxVal) {
    if (screenWidth <= 380.0) {
      return minVal;
    }
    if (screenWidth >= 450.0) {
      return maxVal;
    }
    final double fraction = (screenWidth - 380.0) / (450.0 - 380.0);
    return minVal + fraction * (maxVal - minVal);
  }

  /// Common layout values adapted for media queries (380px - 450px)
  double get padding => scale(12.0, 20.0);
  double get margin => scale(12.0, 20.0);
  double get cardRadius => scale(12.0, 16.0);
  double get spacing => scale(10.0, 20.0);

  // Scaled typography sizes
  double get fontSizeTitle => scale(18.0, 22.0);
  double get fontSizeHeading => scale(15.0, 18.0);
  double get fontSizeBody => scale(13.0, 15.0);
  double get fontSizeCaption => scale(10.0, 12.0);
  double get fontSizeLargeCount => scale(26.0, 32.0);
}
