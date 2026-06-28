import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

// Reanimated components are third-party wrappers, so NativeWind does not map className
// to style for them unless we register the interop explicitly.
cssInterop(Animated.View, { className: 'style' });
