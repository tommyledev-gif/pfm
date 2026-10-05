import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { MapPinIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Coordinates } from "@/features/transactions/location/capture-location";
import { CAN_RENDER_MAP, formatCoordinates, openInGoogleMaps } from "@/features/transactions/location/map-support";

interface LocationMapProps {
  coords: Coordinates;
  // Given: the pin follows a tap on the map or a drag of the pin itself — a
  // fix taken indoors can be a street off. Omitted: a still preview, and a
  // tap opens the spot in Google Maps.
  onMove?: (coords: Coordinates) => void;
  style?: StyleProp<ViewStyle>;
}

// About 400 m across: close enough to tell one street from the next.
const ZOOM_DELTA = 0.004;

// Callers remount it (`key`) for a new fix: the region is only the initial one,
// so a pin the User moves never yanks the camera after it.
export function LocationMap({ coords, onMove, style }: LocationMapProps) {
  const colors = useColors();
  const styles = useStyles();

  if (!CAN_RENDER_MAP) {
    return (
      <Pressable style={[styles.fallback, style]} onPress={() => openInGoogleMaps(coords)}>
        <MapPinIcon size={28} color={colors.green} />
        <Text style={styles.fallbackCoords}>{formatCoordinates(coords)}</Text>
        <Text style={styles.fallbackLink}>Mở trên Google Maps</Text>
      </Pressable>
    );
  }

  const interactive = Boolean(onMove);
  return (
    <View style={[styles.frame, style]}>
      <MapView
        style={styles.map}
        initialRegion={{ ...coords, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA }}
        onPress={(e) => (onMove ? onMove(e.nativeEvent.coordinate) : openInGoogleMaps(coords))}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        // Android draws a still bitmap instead of a live map — a preview in a
        // scrolling sheet has no use for the rest.
        liteMode={!interactive}
      >
        <Marker
          coordinate={coords}
          draggable={interactive}
          onDragEnd={(e) => onMove?.(e.nativeEvent.coordinate)}
        />
      </MapView>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  frame: { borderRadius: radii.listCard, overflow: "hidden", backgroundColor: colors.surfaceRaised },
  map: { flex: 1 },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
  },
  fallbackCoords: { ...typography.body, color: colors.textPrimary },
  fallbackLink: { ...typography.caption, color: colors.green },
}));
