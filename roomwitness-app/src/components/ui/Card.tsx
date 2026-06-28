// White surface with the §1.4 cardShadow + hairline. Replaces the repeated
// `bg-white rounded-lg border border-gray-200 p-4`. See DESIGN_SYSTEM.md §3.2.

import { View, type ViewProps } from 'react-native';
import { cardShadow } from '@/theme/tokens';

export function Card({
  padded = true,
  className = '',
  style,
  children,
  ...rest
}: ViewProps & { padded?: boolean }) {
  // Shadow is a style object (RN shadows aren't Tailwind); hairline + radius via className.
  return (
    <View
      style={[cardShadow, style]}
      className={`bg-card rounded-lg border border-card-border ${padded ? 'p-4' : ''} ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}
