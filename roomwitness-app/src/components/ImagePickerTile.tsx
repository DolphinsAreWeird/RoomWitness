import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, TouchableOpacity, View } from 'react-native';
import { Body, Icon } from '@/components/ui';

export function ImagePickerTile({
  label,
  sublabel,
  onPick,
  uri,
  multiple = false,
}: {
  label: string;
  sublabel: string;
  onPick: (uri: string) => void;
  uri?: string;
  multiple?: boolean;
}) {
  async function pick() {
    // Ask for library access first; bail with a clear message if denied (cancel is a no-op).
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'ต้องอนุญาตเข้าถึงรูปภาพ',
        'กรุณาอนุญาตให้แอปเข้าถึงคลังรูปภาพในการตั้งค่า · Please allow photo access in Settings.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: multiple,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      result.assets.forEach((a) => onPick(a.uri));
    }
  }

  return (
    <TouchableOpacity
      onPress={pick}
      className="border border-card-border rounded-lg p-4 items-center justify-center min-h-[100px] bg-card"
      activeOpacity={0.7}
    >
      {uri ? (
        <Image source={{ uri }} className="w-full h-24 rounded-md" resizeMode="cover" />
      ) : (
        <>
          <View className="mb-1">
            <Icon name="Camera" color="muted" />
          </View>
          <Body size="sm" weight="semibold" className="text-center">
            {label}
          </Body>
          <Body tone="muted" size="sm" className="text-xs text-center mt-0.5">
            {sublabel}
          </Body>
        </>
      )}
    </TouchableOpacity>
  );
}
