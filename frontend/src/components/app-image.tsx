import React, { useState } from "react";
import { Image as ExpoImage, ImageProps as ExpoImageProps } from "expo-image";

export const FALLBACK_IMAGES = {
  food: require("@/assets/images/food.png"),
  groceries: require("@/assets/images/groceries.png"),
  shop: require("@/assets/images/shop.png"),
};

export type FallbackType = keyof typeof FALLBACK_IMAGES;

export interface AppImageProps extends Omit<ExpoImageProps, "source"> {
  source?: any;
  fallbackType?: FallbackType;
}

/**
 * Universal Image component that falls back to:
 * - food.png for food items
 * - groceries.png for grocery items
 * - shop.png for shop/seller images
 * whenever the image source is empty/invalid or fails to load.
 */
export function AppImage({
  source,
  fallbackType = "food",
  onError,
  ...props
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);

  const fallbackSource = FALLBACK_IMAGES[fallbackType] || FALLBACK_IMAGES.food;

  // Determine if valid source exists
  const uri = typeof source === "object" && source !== null && "uri" in source ? source.uri : null;
  const isInvalidUri = typeof source === "object" && source !== null && "uri" in source && (!uri || typeof uri !== "string" || uri.trim() === "");

  if (hasError || !source || isInvalidUri) {
    return <ExpoImage source={fallbackSource} {...props} />;
  }

  return (
    <ExpoImage
      source={source}
      onError={(err) => {
        setHasError(true);
        if (onError) onError(err);
      }}
      {...props}
    />
  );
}

