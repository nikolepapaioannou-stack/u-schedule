import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle, Polyline, Line, Rect } from "react-native-svg";

type IconName = 
  | "magnify"
  | "calendar-outline"
  | "bell-outline"
  | "account-outline"
  | "view-grid-outline"
  | "clock-outline"
  | "cog-outline"
  | "eye-outline"
  | "eye-off-outline"
  | "alert-circle-outline"
  | "cellphone"
  | "chevron-right"
  | "chevron-left"
  | "check"
  | "close"
  | "plus"
  | "minus"
  | "calendar"
  | "calendar-check"
  | "calendar-clock"
  | "calendar-remove"
  | "file-document-outline"
  | "school-outline"
  | "account-group-outline"
  | "timer-outline"
  | "check-circle-outline"
  | "close-circle-outline"
  | "information-outline"
  | "logout"
  | "fingerprint"
  | "shield-check-outline"
  | "email-outline"
  | "lock-outline"
  | "refresh";

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = "#000" }: AppIconProps) {
  const strokeWidth = 2;
  
  const renderIcon = () => {
    switch (name) {
      case "magnify":
        return (
          <>
            <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "calendar-outline":
      case "calendar":
        return (
          <>
            <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "bell-outline":
        return (
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth={strokeWidth} fill="none" />
        );
      case "account-outline":
        return (
          <>
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "view-grid-outline":
        return (
          <>
            <Rect x="3" y="3" width="7" height="7" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Rect x="14" y="3" width="7" height="7" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Rect x="14" y="14" width="7" height="7" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Rect x="3" y="14" width="7" height="7" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "clock-outline":
      case "timer-outline":
      case "calendar-clock":
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="12 6 12 12 16 14" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "cog-outline":
        return (
          <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={color} strokeWidth={strokeWidth} fill="none" />
        );
      case "eye-outline":
        return (
          <>
            <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "eye-off-outline":
        return (
          <>
            <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "alert-circle-outline":
      case "information-outline":
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "cellphone":
        return (
          <>
            <Rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="12" y1="18" x2="12.01" y2="18" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "chevron-right":
        return <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth={strokeWidth} fill="none" />;
      case "chevron-left":
        return <Polyline points="15 18 9 12 15 6" stroke={color} strokeWidth={strokeWidth} fill="none" />;
      case "check":
        return <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={strokeWidth} fill="none" />;
      case "close":
        return (
          <>
            <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "plus":
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "minus":
        return <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={strokeWidth} />;
      case "calendar-check":
      case "check-circle-outline":
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="9 12 11 14 15 10" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "calendar-remove":
      case "close-circle-outline":
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="15" y1="9" x2="9" y2="15" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="9" y1="9" x2="15" y2="15" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "file-document-outline":
        return (
          <>
            <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="16" y1="13" x2="8" y2="13" stroke={color} strokeWidth={strokeWidth} />
            <Line x1="16" y1="17" x2="8" y2="17" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "school-outline":
        return (
          <>
            <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "account-group-outline":
        return (
          <>
            <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "logout":
        return (
          <>
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
      case "fingerprint":
      case "lock-outline":
        return (
          <>
            <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "shield-check-outline":
        return (
          <>
            <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="9 12 11 14 15 10" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "email-outline":
        return (
          <>
            <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="22,6 12,13 2,6" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      case "refresh":
        return (
          <>
            <Polyline points="23 4 23 10 17 10" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Polyline points="1 20 1 14 7 14" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke={color} strokeWidth={strokeWidth} fill="none" />
          </>
        );
      default:
        return (
          <>
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke={color} strokeWidth={strokeWidth} fill="none" />
            <Line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth={strokeWidth} />
          </>
        );
    }
  };

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        {renderIcon()}
      </Svg>
    </View>
  );
}
